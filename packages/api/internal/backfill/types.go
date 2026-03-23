package backfill

import "time"

// Options configures a backfill run.
type Options struct {
	SeedsPath   string
	MaxHops     int
	DryRun      bool
	Concurrency int
	BatchSize   int
	BatchDelay  time.Duration
}

// DiscoveredUser contains crawl metadata for an included DID.
type DiscoveredUser struct {
	DID    string
	Hop    int
	Source string
	Reason string
}
