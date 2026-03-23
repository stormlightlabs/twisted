package backfill

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRepoStatusNotFound(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/info/did:plc:missing" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	admin, err := NewHTTPTapAdmin(ts.URL+"/channel", "")
	if err != nil {
		t.Fatalf("new admin: %v", err)
	}

	status, err := admin.RepoStatus(context.Background(), "did:plc:missing")
	if err != nil {
		t.Fatalf("repo status: %v", err)
	}
	if status.Found {
		t.Fatalf("expected found=false, got %#v", status)
	}
	if status.Tracked {
		t.Fatalf("expected tracked=false for 404")
	}
}

func TestRepoStatusParsesBackfillState(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/info/did:plc:abc" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"tracked":true,"status":"backfilling"}`)
	}))
	defer ts.Close()

	admin, err := NewHTTPTapAdmin(ts.URL+"/channel", "")
	if err != nil {
		t.Fatalf("new admin: %v", err)
	}

	status, err := admin.RepoStatus(context.Background(), "did:plc:abc")
	if err != nil {
		t.Fatalf("repo status: %v", err)
	}
	if !status.Found || !status.Tracked {
		t.Fatalf("expected tracked found status, got %#v", status)
	}
	if !status.Backfilling {
		t.Fatalf("expected backfilling=true, got %#v", status)
	}
	if status.Backfilled {
		t.Fatalf("expected backfilled=false, got %#v", status)
	}
}

func TestRepoStatusParsesExplicitTrackedFalse(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"tracked":false}`)
	}))
	defer ts.Close()

	admin, err := NewHTTPTapAdmin(ts.URL+"/channel", "")
	if err != nil {
		t.Fatalf("new admin: %v", err)
	}

	status, err := admin.RepoStatus(context.Background(), "did:plc:abc")
	if err != nil {
		t.Fatalf("repo status: %v", err)
	}
	if status.Tracked {
		t.Fatalf("expected tracked=false, got %#v", status)
	}
}
