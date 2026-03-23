package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"tangled.org/desertthunder.dev/twister/internal/config"
	"tangled.org/desertthunder.dev/twister/internal/observability"
)

var (
	version = "dev"
	commit  = "none"
)

func main() {
	root := &cobra.Command{
		Use:     "twister",
		Short:   "Tangled search service",
		Version: fmt.Sprintf("%s (%s)", version, commit),
	}

	root.AddCommand(
		newAPICmd(),
		newIndexerCmd(),
		newEmbedWorkerCmd(),
		newReindexCmd(),
		newReembedCmd(),
		newHealthcheckCmd(),
	)

	if err := root.Execute(); err != nil {
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
		Use:   "api",
		Short: "Start the HTTP search API",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}
			log := observability.NewLogger(cfg)
			log.Info("starting api", slog.String("service", "api"), slog.String("version", version), slog.String("addr", cfg.HTTPBindAddr))
			ctx, cancel := baseContext()
			defer cancel()
			<-ctx.Done()
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
			ctx, cancel := baseContext()
			defer cancel()
			<-ctx.Done()
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
