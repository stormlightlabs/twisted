package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"tangled.org/desertthunder.dev/twister/internal/api"
	"tangled.org/desertthunder.dev/twister/internal/backfill"
	"tangled.org/desertthunder.dev/twister/internal/config"
	"tangled.org/desertthunder.dev/twister/internal/ingest"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/observability"
	"tangled.org/desertthunder.dev/twister/internal/search"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/tapclient"
)

var (
	version = "dev"
	commit  = "none"
)

func main() {
	root := &cobra.Command{
		Use:           "twister",
		Short:         "Tangled search service",
		Version:       fmt.Sprintf("%s (%s)", version, commit),
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.AddCommand(
		newAPICmd(),
		newIndexerCmd(),
		newBackfillCmd(),
		newEmbedWorkerCmd(),
		newReindexCmd(),
		newReembedCmd(),
		newHealthcheckCmd(),
	)

	if err := root.Execute(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}

func baseContext() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGTERM, syscall.SIGINT)
		<-ch
		cancel()
	}()
	return ctx, cancel
}

func newAPICmd() *cobra.Command {
	return &cobra.Command{
		Use:     "api",
		Aliases: []string{"serve"},
		Short:   "Start the HTTP search API",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting api", slog.String("service", "api"), slog.String("version", version), slog.String("addr", cfg.HTTPBindAddr))

			db, err := store.Open(cfg.TursoURL, cfg.TursoToken)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			defer db.Close()

			if err := store.Migrate(db); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			st := store.New(db)
			searchRepo := search.NewRepository(db)
			srv := api.New(searchRepo, st, cfg, log)

			ctx, cancel := baseContext()
			defer cancel()

			if err := srv.Run(ctx); err != nil {
				return fmt.Errorf("run api: %w", err)
			}

			log.Info("shutting down api")
			return nil
		},
	}
}

func newIndexerCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "indexer",
		Short: "Start the Tap consumer and indexer",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting indexer", slog.String("service", "indexer"), slog.String("version", version))

			if cfg.TapURL == "" {
				return fmt.Errorf("TAP_URL is required for indexer")
			}

			db, err := store.Open(cfg.TursoURL, cfg.TursoToken)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			defer db.Close()

			if err := store.Migrate(db); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			st := store.New(db)
			registry := normalize.NewRegistry()
			tap := tapclient.New(cfg.TapURL, cfg.TapAuthPassword, log)
			runner := ingest.NewRunner(st, registry, tap, cfg.IndexedCollections, log)

			ctx, cancel := baseContext()
			defer cancel()

			if err := runner.Run(ctx); err != nil {
				return fmt.Errorf("run indexer: %w", err)
			}

			log.Info("shutting down indexer")
			return nil
		},
	}
}

func newEmbedWorkerCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "embed-worker",
		Short: "Start the async embedding worker",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting embed-worker", slog.String("service", "embed-worker"), slog.String("version", version))
			ctx, cancel := baseContext()
			defer cancel()
			<-ctx.Done()
			log.Info("shutting down embed-worker")
			return nil
		},
	}
}

func newBackfillCmd() *cobra.Command {
	var opts backfill.Options

	cmd := &cobra.Command{
		Use:   "backfill",
		Short: "Discover users from seeds and register repos for Tap backfill",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting backfill", slog.String("service", "backfill"), slog.String("version", version))

			if cfg.TapURL == "" {
				return fmt.Errorf("TAP_URL is required for backfill")
			}

			db, err := store.Open(cfg.TursoURL, cfg.TursoToken)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			defer db.Close()

			if err := store.Migrate(db); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			tapAdmin, err := backfill.NewHTTPTapAdmin(cfg.TapURL, cfg.TapAuthPassword)
			if err != nil {
				return fmt.Errorf("tap admin client: %w", err)
			}

			runner := backfill.NewRunner(
				store.New(db),
				tapAdmin,
				backfill.NewHTTPHandleResolver(""),
				log,
			)

			ctx, cancel := baseContext()
			defer cancel()

			if err := runner.Run(ctx, opts); err != nil {
				return fmt.Errorf("run backfill: %w", err)
			}

			log.Info("shutting down backfill")
			return nil
		},
	}

	cmd.Flags().StringVar(&opts.SeedsPath, "seeds", "", "Seed source: file path or comma-separated DIDs/handles (required)")
	cmd.Flags().IntVar(&opts.MaxHops, "max-hops", 2, "Max fan-out depth from seeds")
	cmd.Flags().BoolVar(&opts.DryRun, "dry-run", false, "Print discovery plan without mutating Tap")
	cmd.Flags().IntVar(&opts.Concurrency, "concurrency", 5, "Parallel discovery workers")
	cmd.Flags().IntVar(&opts.BatchSize, "batch-size", 10, "DIDs per /repos/add request")
	cmd.Flags().DurationVar(&opts.BatchDelay, "batch-delay", time.Second, "Delay between Tap /repos/add batches")
	_ = cmd.MarkFlagRequired("seeds")

	return cmd
}

func newReindexCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "reindex",
		Short: "Re-normalize and upsert all documents",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("reindex: not yet implemented")
			return nil
		},
	}
}

func newReembedCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "reembed",
		Short: "Re-generate all embeddings",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("reembed: not yet implemented")
			return nil
		},
	}
}

func newHealthcheckCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "healthcheck",
		Short: "One-shot health probe",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("healthcheck: ok")
			return nil
		},
	}
}
