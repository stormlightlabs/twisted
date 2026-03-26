package backfill

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"
)

func TestHTTPLightrailClientListReposByCollectionSinglePage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/"+listReposByCollectionNSID {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"repos": []map[string]string{
				{"did": "did:plc:a"},
				{"did": "did:plc:b"},
			},
		})
	}))
	defer srv.Close()

	client := NewHTTPLightrailClient()
	dids, err := client.ListReposByCollection(
		context.Background(), srv.URL, []string{"sh.tangled.repo"}, 100,
	)
	if err != nil {
		t.Fatalf("list repos: %v", err)
	}

	want := []string{"did:plc:a", "did:plc:b"}
	if !reflect.DeepEqual(dids, want) {
		t.Fatalf("dids: got %#v want %#v", dids, want)
	}
}

func TestHTTPLightrailClientListReposByCollectionPaginatesAndDedupes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		cursor := query.Get("cursor")
		switch cursor {
		case "":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"cursor": "page-2",
				"repos": []map[string]string{
					{"did": "did:plc:a"},
					{"did": "did:plc:b"},
				},
			})
		case "page-2":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"repos": []map[string]string{
					{"did": "did:plc:b"},
					{"did": "did:plc:c"},
				},
			})
		default:
			t.Fatalf("unexpected cursor %q", cursor)
		}
	}))
	defer srv.Close()

	client := NewHTTPLightrailClient()
	dids, err := client.ListReposByCollection(
		context.Background(), srv.URL, []string{"sh.tangled.repo"}, 2,
	)
	if err != nil {
		t.Fatalf("list repos: %v", err)
	}

	want := []string{"did:plc:a", "did:plc:b", "did:plc:c"}
	if !reflect.DeepEqual(dids, want) {
		t.Fatalf("dids: got %#v want %#v", dids, want)
	}
}

func TestHTTPLightrailClientListReposByCollectionAddsRepeatedCollections(t *testing.T) {
	var got url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.URL.Query()
		_ = json.NewEncoder(w).Encode(map[string]any{"repos": []map[string]string{}})
	}))
	defer srv.Close()

	client := NewHTTPLightrailClient()
	if _, err := client.ListReposByCollection(
		context.Background(),
		srv.URL,
		[]string{"sh.tangled.actor.profile", "sh.tangled.repo"},
		50,
	); err != nil {
		t.Fatalf("list repos: %v", err)
	}

	if got.Get("limit") != "50" {
		t.Fatalf("limit: got %q", got.Get("limit"))
	}
	if values := got["collection"]; !reflect.DeepEqual(values, []string{
		"sh.tangled.actor.profile",
		"sh.tangled.repo",
	}) {
		t.Fatalf("collections: got %#v", values)
	}
}

func TestHTTPLightrailClientListReposByCollectionErrorsOnNonSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"boom"}`, http.StatusBadGateway)
	}))
	defer srv.Close()

	client := NewHTTPLightrailClient()
	if _, err := client.ListReposByCollection(
		context.Background(), srv.URL, []string{"sh.tangled.repo"}, 100,
	); err == nil {
		t.Fatal("expected error")
	}
}
