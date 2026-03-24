package observability

import (
	"log/slog"
	"os"

	charmlog "github.com/charmbracelet/log"
	"tangled.org/desertthunder.dev/twister/internal/config"
)

func NewLogger(cfg *config.Config) *slog.Logger {
	level := charmlog.InfoLevel
	switch cfg.LogLevel {
	case "debug":
		level = charmlog.DebugLevel
	case "warn":
		level = charmlog.WarnLevel
	case "error":
		level = charmlog.ErrorLevel
	}

	var handler slog.Handler
	if cfg.LogFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.Level(level)})
	} else {
		handler = charmlog.NewWithOptions(os.Stdout, charmlog.Options{
			Level:           level,
			ReportTimestamp: true,
		})
	}

	return slog.New(handler)
}
