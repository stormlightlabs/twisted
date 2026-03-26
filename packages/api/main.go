package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"tangled.org/desertthunder.dev/twister/internal/api"
	"tangled.org/desertthunder.dev/twister/internal/backfill"
	"tangled.org/desertthunder.dev/twister/internal/config"
	"tangled.org/desertthunder.dev/twister/internal/constellation"
	"tangled.org/desertthunder.dev/twister/internal/enrich"
	"tangled.org/desertthunder.dev/twister/internal/ingest"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/observability"
	"tangled.org/desertthunder.dev/twister/internal/reindex"
	"tangled.org/desertthunder.dev/twister/internal/search"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/tapclient"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

var (
	version = "dev"
	commit  = "none"
)

func main() {
	var local bool

	root := &cobra.Command{
		Use:           "twister",
		Short:         "Tangled search service",
		Version:       fmt.Sprintf("%s (%s)", version, commit),
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.PersistentFlags().BoolVar(&local, "local", false, "Use a local twister-dev.db database and text logs for development")

	root.AddCommand(
		newAPICmd(&local),
		newIndexerCmd(&local),
		newBackfillCmd(&local),
		newReindexCmd(&local),
		newEnrichCmd(&local),
		newHealthcheckCmd(&local),
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

func newAPICmd(local *bool) *cobra.Command {
	return &cobra.Command{
		Use:     "api",
		Aliases: []string{"serve"},
		Short:   "Start the HTTP search API",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
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

			if err := store.Migrate(db, cfg.TursoURL); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			st := store.New(db)
			searchRepo := search.NewRepository(db)

			constellationClient := constellation.NewClient(
				constellation.WithBaseURL(cfg.ConstellationURL),
				constellation.WithUserAgent(cfg.ConstellationUserAgent),
				constellation.WithTimeout(cfg.ConstellationTimeout),
				constellation.WithCacheTTL(cfg.ConstellationCacheTTL),
			)
			log.Info("constellation client configured", slog.String("url", cfg.ConstellationURL))

			xrpcClient := xrpc.NewClient(
				xrpc.WithPLCDirectory(cfg.PLCDirectoryURL),
				xrpc.WithIdentityService(cfg.IdentityServiceURL),
				xrpc.WithTimeout(cfg.XRPCTimeout),
			)

			srv := api.New(searchRepo, st, cfg, log, constellationClient, xrpcClient)

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

func newIndexerCmd(local *bool) *cobra.Command {
	return &cobra.Command{
		Use:   "indexer",
		Short: "Start the Tap consumer and indexer",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
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

			if err := store.Migrate(db, cfg.TursoURL); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			st := store.New(db)
			registry := normalize.NewRegistry()
			tap := tapclient.New(cfg.TapURL, cfg.TapAuthPassword, log)
			runner := ingest.NewRunner(st, registry, tap, cfg.IndexedCollections, log)

			if cfg.EnableIngestEnrichment {
				xrpcClient := xrpc.NewClient(
					xrpc.WithPLCDirectory(cfg.PLCDirectoryURL),
					xrpc.WithIdentityService(cfg.IdentityServiceURL),
					xrpc.WithTimeout(cfg.XRPCTimeout),
				)
				runner.SetXRPCClient(xrpcClient)
				log.Info("ingest enrichment enabled")
			}

			ctx, cancel := baseContext()
			defer cancel()

			healthMux := http.NewServeMux()
			healthMux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
				if err := st.Ping(r.Context()); err != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusServiceUnavailable)
					fmt.Fprintf(w, `{"status":"unhealthy","error":"db_unreachable"}`)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintf(w, `{"status":"ok"}`)
			})
			healthSrv := &http.Server{
				Addr:              cfg.IndexerHealthAddr,
				Handler:           healthMux,
				ReadHeaderTimeout: 5 * time.Second,
			}
			go func() {
				log.Info("indexer health server listening", slog.String("addr", cfg.IndexerHealthAddr))
				if err := healthSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
					log.Error("indexer health server failed", slog.String("error", err.Error()))
				}
			}()
			defer func() {
				shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer shutdownCancel()
				_ = healthSrv.Shutdown(shutdownCtx)
			}()

			if err := runner.Run(ctx); err != nil {
				return fmt.Errorf("run indexer: %w", err)
			}

			log.Info("shutting down indexer")
			return nil
		},
	}
}

func newBackfillCmd(local *bool) *cobra.Command {
	var opts backfill.Options

	cmd := &cobra.Command{
		Use:   "backfill",
		Short: "Discover repos and register them with Tap backfill",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
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

			if err := store.Migrate(db, cfg.TursoURL); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			tapAdmin, err := backfill.NewHTTPTapAdmin(cfg.TapURL, cfg.TapAuthPassword)
			if err != nil {
				return fmt.Errorf("tap admin client: %w", err)
			}

			xrpcClient := xrpc.NewClient(
				xrpc.WithPLCDirectory(cfg.PLCDirectoryURL),
				xrpc.WithIdentityService(cfg.IdentityServiceURL),
				xrpc.WithTimeout(cfg.XRPCTimeout),
			)

			runner := backfill.NewRunner(
				store.New(db),
				tapAdmin,
				xrpcClient,
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

	cmd.Flags().StringVar(&opts.Source, "source", backfill.SourceLightrail, "Discovery source: lightrail or graph")
	cmd.Flags().StringVar(&opts.LightrailURL, "lightrail-url", backfill.DefaultLightrailURL, "Base URL for listReposByCollection discovery")
	cmd.Flags().StringArrayVar(&opts.Collections, "collection", nil, "Collection to discover via Lightrail (repeatable)")
	cmd.Flags().IntVar(&opts.PageLimit, "page-limit", backfill.DefaultPageLimit, "Max DIDs to request per Lightrail page")
	cmd.Flags().StringVar(&opts.SeedsPath, "seeds", "", "Seed source for --source graph: file path or comma-separated DIDs/handles")
	cmd.Flags().IntVar(&opts.MaxHops, "max-hops", 2, "Max fan-out depth from graph seeds")
	cmd.Flags().BoolVar(&opts.DryRun, "dry-run", false, "Print discovery plan without mutating Tap")
	cmd.Flags().IntVar(&opts.Concurrency, "concurrency", 5, "Parallel discovery workers")
	cmd.Flags().IntVar(&opts.BatchSize, "batch-size", 10, "DIDs per /repos/add request")
	cmd.Flags().DurationVar(&opts.BatchDelay, "batch-delay", time.Second, "Delay between Tap /repos/add batches")

	return cmd
}

func newReindexCmd(local *bool) *cobra.Command {
	var opts reindex.Options

	cmd := &cobra.Command{
		Use:   "reindex",
		Short: "Re-normalize and upsert all documents into the FTS index",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting reindex", slog.String("service", "reindex"), slog.String("version", version))

			db, err := store.Open(cfg.TursoURL, cfg.TursoToken)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			defer db.Close()

			if err := store.Migrate(db, cfg.TursoURL); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			ctx, cancel := baseContext()
			defer cancel()

			runner := reindex.New(store.New(db), log)
			result, err := runner.Run(ctx, opts)
			if result != nil {
				log.Info("reindex finished",
					slog.Int("total", result.Total),
					slog.Int("updated", result.Updated),
					slog.Int("errors", result.Errors),
				)
			}
			return err
		},
	}

	cmd.Flags().StringVar(&opts.Collection, "collection", "", "Reindex only documents in this collection")
	cmd.Flags().StringVar(&opts.DID, "did", "", "Reindex only documents authored by this DID")
	cmd.Flags().StringVar(&opts.DocumentID, "document", "", "Reindex a single document by stable ID")
	cmd.Flags().BoolVar(&opts.DryRun, "dry-run", false, "Show intended work without writing")

	return cmd
}

func newEnrichCmd(local *bool) *cobra.Command {
	var opts enrich.Options

	cmd := &cobra.Command{
		Use:   "enrich",
		Short: "Backfill RepoName, AuthorHandle, and WebURL on existing documents",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting enrich", slog.String("service", "enrich"), slog.String("version", version))

			db, err := store.Open(cfg.TursoURL, cfg.TursoToken)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			defer db.Close()

			if err := store.Migrate(db, cfg.TursoURL); err != nil {
				return fmt.Errorf("migrate database: %w", err)
			}

			xrpcClient := xrpc.NewClient(
				xrpc.WithPLCDirectory(cfg.PLCDirectoryURL),
				xrpc.WithIdentityService(cfg.IdentityServiceURL),
				xrpc.WithTimeout(cfg.XRPCTimeout),
			)

			ctx, cancel := baseContext()
			defer cancel()

			runner := enrich.New(store.New(db), xrpcClient, log)
			result, err := runner.Run(ctx, opts)
			if result != nil {
				log.Info("enrich finished",
					slog.Int("total", result.Total),
					slog.Int("updated", result.Updated),
					slog.Int("skipped", result.Skipped),
					slog.Int("errors", result.Errors),
				)
			}
			return err
		},
	}

	cmd.Flags().StringVar(&opts.Collection, "collection", "", "Enrich only documents in this collection")
	cmd.Flags().StringVar(&opts.DID, "did", "", "Enrich only documents authored by this DID")
	cmd.Flags().StringVar(&opts.DocumentID, "document", "", "Enrich a single document by stable ID")
	cmd.Flags().BoolVar(&opts.DryRun, "dry-run", false, "Show intended work without writing")
	cmd.Flags().IntVar(&opts.Concurrency, "concurrency", 5, "Parallel enrichment workers")

	return cmd
}

func newHealthcheckCmd(local *bool) *cobra.Command {
	return &cobra.Command{
		Use:   "healthcheck",
		Short: "One-shot health probe",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(config.LoadOptions{Local: *local})
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("healthcheck: ok")
			return nil
		},
	}
}
