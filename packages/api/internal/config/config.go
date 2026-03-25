package config

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	TursoURL               string
	TursoToken             string
	TapURL                 string
	TapAuthPassword        string
	IndexedCollections     string
	SearchDefaultLimit     int
	SearchMaxLimit         int
	SearchDefaultMode      string
	EmbeddingProvider      string
	EmbeddingModel         string
	EmbeddingAPIKey        string
	EmbeddingAPIURL        string
	EmbeddingDim           int
	EmbeddingBatchSize     int
	HybridKeywordWeight    float64
	HybridSemanticWeight   float64
	HTTPBindAddr           string
	IndexerHealthAddr      string
	LogLevel               string
	LogFormat              string
	EnableAdminEndpoints   bool
	AdminAuthToken         string
	EnableIngestEnrichment bool
	PLCDirectoryURL        string
	IdentityServiceURL     string
	XRPCTimeout            time.Duration
	ConstellationURL       string
	ConstellationUserAgent string
	ConstellationTimeout   time.Duration
	ConstellationCacheTTL  time.Duration
	OAuthClientID             string
	OAuthRedirectURIs         []string
	JetstreamURL              string
	JetstreamWantedCollections string
	ActivityMaxEvents         int
	ActivityRewindDuration    time.Duration
}

type LoadOptions struct {
	Local   bool
	WorkDir string
}

func Load(opts LoadOptions) (*Config, error) {
	loadDotEnv()

	cfg := &Config{
		TursoURL:               os.Getenv("TURSO_DATABASE_URL"),
		TursoToken:             os.Getenv("TURSO_AUTH_TOKEN"),
		TapURL:                 os.Getenv("TAP_URL"),
		TapAuthPassword:        os.Getenv("TAP_AUTH_PASSWORD"),
		IndexedCollections:     os.Getenv("INDEXED_COLLECTIONS"),
		SearchDefaultMode:      envOrDefault("SEARCH_DEFAULT_MODE", "keyword"),
		EmbeddingProvider:      os.Getenv("EMBEDDING_PROVIDER"),
		EmbeddingModel:         os.Getenv("EMBEDDING_MODEL"),
		EmbeddingAPIKey:        os.Getenv("EMBEDDING_API_KEY"),
		EmbeddingAPIURL:        os.Getenv("EMBEDDING_API_URL"),
		HTTPBindAddr:           envOrDefault("HTTP_BIND_ADDR", ":8080"),
		IndexerHealthAddr:      envOrDefault("INDEXER_HEALTH_ADDR", ":9090"),
		LogLevel:               envOrDefault("LOG_LEVEL", "info"),
		LogFormat:              envOrDefault("LOG_FORMAT", "json"),
		AdminAuthToken:         os.Getenv("ADMIN_AUTH_TOKEN"),
		SearchDefaultLimit:     envInt("SEARCH_DEFAULT_LIMIT", 20),
		SearchMaxLimit:         envInt("SEARCH_MAX_LIMIT", 100),
		EmbeddingDim:           envInt("EMBEDDING_DIM", 768),
		EmbeddingBatchSize:     envInt("EMBEDDING_BATCH_SIZE", 32),
		HybridKeywordWeight:    envFloat("HYBRID_KEYWORD_WEIGHT", 0.65),
		HybridSemanticWeight:   envFloat("HYBRID_SEMANTIC_WEIGHT", 0.35),
		EnableAdminEndpoints:   envBool("ENABLE_ADMIN_ENDPOINTS", false),
		EnableIngestEnrichment: envBool("ENABLE_INGEST_ENRICHMENT", true),
		PLCDirectoryURL:        envOrDefault("PLC_DIRECTORY_URL", "https://plc.directory"),
		IdentityServiceURL:     envOrDefault("IDENTITY_SERVICE_URL", "https://public.api.bsky.app"),
		XRPCTimeout:            envDuration("XRPC_TIMEOUT", 15*time.Second),
		ConstellationURL:       envOrDefault("CONSTELLATION_URL", "https://constellation.microcosm.blue"),
		ConstellationUserAgent: envOrDefault("CONSTELLATION_USER_AGENT", "twister/1.0 (https://tangled.org/desertthunder.dev/twisted; Owais <desertthunder.dev@gmail.com>)"),
		ConstellationTimeout:   envDuration("CONSTELLATION_TIMEOUT", 10*time.Second),
		ConstellationCacheTTL:  envDuration("CONSTELLATION_CACHE_TTL", 5*time.Minute),
		OAuthClientID:              os.Getenv("OAUTH_CLIENT_ID"),
		OAuthRedirectURIs:          envSlice("OAUTH_REDIRECT_URIS", nil),
		JetstreamURL:               envOrDefault("JETSTREAM_URL", "wss://jetstream2.us-east.bsky.network/subscribe"),
		JetstreamWantedCollections: envOrDefault("JETSTREAM_WANTED_COLLECTIONS", "sh.tangled.*"),
		ActivityMaxEvents:          envInt("ACTIVITY_MAX_EVENTS", 500),
		ActivityRewindDuration:     envDuration("ACTIVITY_REWIND_DURATION", 5*time.Minute),
	}

	if opts.Local {
		dbURL, err := localDatabaseURL(opts.WorkDir)
		if err != nil {
			return nil, err
		}
		cfg.TursoURL = dbURL
		cfg.TursoToken = ""
		cfg.LogFormat = "text"
	}

	var errs []error
	if cfg.TursoURL == "" {
		errs = append(errs, errors.New("TURSO_DATABASE_URL is required"))
	}
	if cfg.TursoToken == "" && !strings.HasPrefix(cfg.TursoURL, "file:") {
		errs = append(errs, errors.New("TURSO_AUTH_TOKEN is required for non-file URLs"))
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return cfg, nil
}

func localDatabaseURL(workDir string) (string, error) {
	if strings.TrimSpace(workDir) == "" {
		var err error
		workDir, err = os.Getwd()
		if err != nil {
			return "", err
		}
	}
	return "file:" + filepath.Join(workDir, "twister-dev.db"), nil
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

func envFloat(key string, def float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return def
	}
	return f
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
