package backfill

import "time"

const (
	SourceLightrail     = "lightrail"
	SourceGraph         = "graph"
	DefaultLightrailURL = "https://lightrail.microcosm.blue"
	DefaultPageLimit    = 10000
)

var DefaultCollections = []string{
	"sh.tangled.repo",
	"sh.tangled.repo.issue",
	"sh.tangled.repo.issue.state",
	"sh.tangled.repo.issue.comment",
	"sh.tangled.repo.pull",
	"sh.tangled.repo.pull.status",
	"sh.tangled.repo.pull.comment",
	"sh.tangled.string",
	"sh.tangled.actor.profile",
}

// Options configures a backfill run.
type Options struct {
	SeedsPath    string
	MaxHops      int
	DryRun       bool
	Concurrency  int
	BatchSize    int
	BatchDelay   time.Duration
	Source       string
	LightrailURL string
	Collections  []string
	PageLimit    int
}

// DiscoveredUser contains crawl metadata for an included DID.
type DiscoveredUser struct {
	DID    string
	Hop    int
	Source string
	Reason string
}
