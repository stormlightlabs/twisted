package config

import (
	"errors"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL                string
	TapURL                     string
	TapAuthPassword            string
	IndexedCollections         string
	ReadThroughMode            string
	ReadThroughCollections     string
	ReadThroughMaxAttempts     int
	SearchDefaultLimit         int
	SearchMaxLimit             int
	SearchDefaultMode          string
	HTTPBindAddr               string
	IndexerHealthAddr          string
	LogLevel                   string
	LogFormat                  string
	EnableAdminEndpoints       bool
	AdminAuthToken             string
	EnableIngestEnrichment     bool
	PLCDirectoryURL            string
	IdentityServiceURL         string
	XRPCTimeout                time.Duration
	ConstellationURL           string
	ConstellationUserAgent     string
	ConstellationTimeout       time.Duration
	ConstellationCacheTTL      time.Duration
	OAuthClientID              string
	OAuthRedirectURIs          []string
	JetstreamURL               string
	JetstreamWantedCollections string
	ActivityMaxEvents          int
	ActivityRewindDuration     time.Duration
}

type LoadOptions struct {
	Local   bool
	WorkDir string
}

func Load(opts LoadOptions) (*Config, error) {
	loadDotEnv()

	cfg := &Config{
		DatabaseURL:                databaseURL(),
		TapURL:                     os.Getenv("TAP_URL"),
		TapAuthPassword:            os.Getenv("TAP_AUTH_PASSWORD"),
		IndexedCollections:         os.Getenv("INDEXED_COLLECTIONS"),
		ReadThroughMode:            envOrDefault("READ_THROUGH_MODE", "missing"),
		ReadThroughCollections:     envOrDefault("READ_THROUGH_COLLECTIONS", os.Getenv("INDEXED_COLLECTIONS")),
		ReadThroughMaxAttempts:     envInt("READ_THROUGH_MAX_ATTEMPTS", 5),
		SearchDefaultMode:          envOrDefault("SEARCH_DEFAULT_MODE", "keyword"),
		HTTPBindAddr:               envBindAddr("HTTP_BIND_ADDR", "PORT", 8080),
		IndexerHealthAddr:          envBindAddr("INDEXER_HEALTH_ADDR", "PORT", 9090),
		LogLevel:                   envOrDefault("LOG_LEVEL", "info"),
		LogFormat:                  envOrDefault("LOG_FORMAT", "json"),
		AdminAuthToken:             os.Getenv("ADMIN_AUTH_TOKEN"),
		SearchDefaultLimit:         envInt("SEARCH_DEFAULT_LIMIT", 20),
		SearchMaxLimit:             envInt("SEARCH_MAX_LIMIT", 100),
		EnableAdminEndpoints:       envBool("ENABLE_ADMIN_ENDPOINTS", false),
		EnableIngestEnrichment:     envBool("ENABLE_INGEST_ENRICHMENT", true),
		PLCDirectoryURL:            envOrDefault("PLC_DIRECTORY_URL", "https://plc.directory"),
		IdentityServiceURL:         envOrDefault("IDENTITY_SERVICE_URL", "https://public.api.bsky.app"),
		XRPCTimeout:                envDuration("XRPC_TIMEOUT", 15*time.Second),
		ConstellationURL:           envOrDefault("CONSTELLATION_URL", "https://constellation.microcosm.blue"),
		ConstellationUserAgent:     envOrDefault("CONSTELLATION_USER_AGENT", "twister/1.0 (https://tangled.org/desertthunder.dev/twisted; Owais <desertthunder.dev@gmail.com>)"),
		ConstellationTimeout:       envDuration("CONSTELLATION_TIMEOUT", 10*time.Second),
		ConstellationCacheTTL:      envDuration("CONSTELLATION_CACHE_TTL", 5*time.Minute),
		OAuthClientID:              os.Getenv("OAUTH_CLIENT_ID"),
		OAuthRedirectURIs:          envSlice("OAUTH_REDIRECT_URIS", nil),
		JetstreamURL:               envOrDefault("JETSTREAM_URL", "wss://jetstream2.us-east.bsky.network/subscribe"),
		JetstreamWantedCollections: envOrDefault("JETSTREAM_WANTED_COLLECTIONS", "sh.tangled.*"),
		ActivityMaxEvents:          envInt("ACTIVITY_MAX_EVENTS", 500),
		ActivityRewindDuration:     envDuration("ACTIVITY_REWIND_DURATION", 5*time.Minute),
	}

	if opts.Local {
		dbURL, err := localSQLiteDatabaseURL(opts.WorkDir)
		if err != nil {
			return nil, err
		}
		cfg.DatabaseURL = dbURL
		cfg.LogFormat = "text"
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return cfg, nil
}

func localSQLiteDatabaseURL(workDir string) (string, error) {
	if strings.TrimSpace(workDir) == "" {
		var err error
		workDir, err = os.Getwd()
		if err != nil {
			return "", err
		}
	}
	return "file:" + filepath.Join(workDir, "twister-dev.db"), nil
}

func databaseURL() string {
	if v := strings.TrimSpace(os.Getenv("DATABASE_URL")); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("TURSO_DATABASE_URL")); v != "" {
		return v
	}
	return defaultLocalDatabaseURL()
}

func defaultLocalDatabaseURL() string {
	userName := strings.TrimSpace(os.Getenv("USER"))
	if userName == "" {
		if current, err := user.Current(); err == nil {
			userName = strings.TrimSpace(current.Username)
		}
	}
	if userName == "" {
		userName = "postgres"
	}
	return "postgresql://localhost/" + userName + "_dev?sslmode=disable"
}

func loadDotEnv() {
	seen := map[string]bool{}
	candidates := make([]string, 0, 8)

	if explicit := strings.TrimSpace(os.Getenv("TWISTER_ENV_FILE")); explicit != "" {
		candidates = append(candidates, explicit)
	}

	if cwd, err := os.Getwd(); err == nil {
		for _, rel := range []string{".env", "../.env", "../../.env"} {
			candidates = append(candidates, filepath.Join(cwd, rel))
		}
	}

	for _, candidate := range candidates {
		if candidate == "" || seen[candidate] {
			continue
		}
		seen[candidate] = true
		if _, err := os.Stat(candidate); err != nil {
			continue
		}

		_ = godotenv.Load(candidate)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envBindAddr(key, portKey string, defaultPort int) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	if port := strings.TrimSpace(os.Getenv(portKey)); port != "" {
		return ":" + port
	}
	return ":" + strconv.Itoa(defaultPort)
}

func envInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func envDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envSlice(key string, def []string) []string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return strings.Split(v, ",")
}
