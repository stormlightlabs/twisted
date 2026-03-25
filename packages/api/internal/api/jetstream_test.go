package api

import (
	"strings"
	"testing"
)

func TestBuildJetstreamURL(t *testing.T) {
	base := "wss://jetstream2.us-east.bsky.network/subscribe"

	t.Run("single collection with cursor", func(t *testing.T) {
		u := buildJetstreamURL(base, "sh.tangled.*", 1_000_000)
		if !strings.Contains(u, "wantedCollections=sh.tangled.*") {
			t.Errorf("missing wantedCollections in %q", u)
		}
		if !strings.Contains(u, "cursor=1000000") {
			t.Errorf("missing cursor in %q", u)
		}
	})

	t.Run("multiple collections", func(t *testing.T) {
		u := buildJetstreamURL(base, "sh.tangled.repo, sh.tangled.repo.issue", 0)
		if !strings.Contains(u, "wantedCollections=sh.tangled.repo") {
			t.Errorf("missing first collection in %q", u)
		}
		if !strings.Contains(u, "wantedCollections=sh.tangled.repo.issue") {
			t.Errorf("missing second collection in %q", u)
		}
		if strings.Contains(u, "cursor=") {
			t.Errorf("unexpected cursor when cursorUS=0 in %q", u)
		}
	})

	t.Run("no collections no cursor", func(t *testing.T) {
		u := buildJetstreamURL(base, "", 0)
		if u != base {
			t.Errorf("expected bare base URL, got %q", u)
		}
	})

	t.Run("wildcard is not percent-encoded", func(t *testing.T) {
		u := buildJetstreamURL(base, "sh.tangled.*", 42)
		if strings.Contains(u, "%2A") {
			t.Errorf("wildcard was percent-encoded in %q", u)
		}
	})
}
