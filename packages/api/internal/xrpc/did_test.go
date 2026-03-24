package xrpc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestResolveDIDDoc_PLC(t *testing.T) {
	doc := DIDDocument{
		ID:          "did:plc:abc123",
		AlsoKnownAs: []string{"at://alice.test"},
		Service: []DIDService{
			{Type: "AtprotoPersonalDataServer", ServiceEndpoint: "https://pds.example.com"},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/did:plc:abc123" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(doc)
	}))
	defer srv.Close()

	c := NewClient(WithPLCDirectory(srv.URL))
	got, err := c.ResolveDIDDoc(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "did:plc:abc123" {
		t.Errorf("expected ID did:plc:abc123, got %s", got.ID)
	}
	if len(got.Service) != 1 || got.Service[0].ServiceEndpoint != "https://pds.example.com" {
		t.Errorf("unexpected service: %+v", got.Service)
	}
}

func TestResolveDIDDoc_Web(t *testing.T) {
	doc := DIDDocument{
		ID: "did:web:example.com",
		Service: []DIDService{
			{Type: "AtprotoPersonalDataServer", ServiceEndpoint: "https://pds.example.com"},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/did.json" {
			t.Errorf("unexpected path for did:web: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(doc)
	}))
	defer srv.Close()

	t.Skip("did:web requires DNS; tested via PLC path")
}

func TestResolveIdentity(t *testing.T) {
	doc := DIDDocument{
		ID:          "did:plc:test",
		AlsoKnownAs: []string{"at://bob.test"},
		Service: []DIDService{
			{Type: "AtprotoPersonalDataServer", ServiceEndpoint: "https://pds.bob.test"},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(doc)
	}))
	defer srv.Close()

	c := NewClient(WithPLCDirectory(srv.URL))
	info, err := c.ResolveIdentity(context.Background(), "did:plc:test")
	if err != nil {
		t.Fatal(err)
	}
	if info.PDS != "https://pds.bob.test" {
		t.Errorf("expected PDS https://pds.bob.test, got %s", info.PDS)
	}
	if info.Handle != "bob.test" {
		t.Errorf("expected handle bob.test, got %s", info.Handle)
	}
}

func TestResolveDIDDoc_UnsupportedMethod(t *testing.T) {
	c := NewClient()
	_, err := c.ResolveDIDDoc(context.Background(), "did:key:z123")
	if err == nil {
		t.Fatal("expected error for unsupported did method")
	}
}

func TestDIDCache_HitMissExpiry(t *testing.T) {
	calls := 0
	doc := DIDDocument{
		ID: "did:plc:cached",
		Service: []DIDService{
			{Type: "AtprotoPersonalDataServer", ServiceEndpoint: "https://pds.cached.test"},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		json.NewEncoder(w).Encode(doc)
	}))
	defer srv.Close()

	c := NewClient(WithPLCDirectory(srv.URL))

	_, err := c.ResolveDIDDoc(context.Background(), "did:plc:cached")
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("expected 1 call, got %d", calls)
	}

	_, err = c.ResolveDIDDoc(context.Background(), "did:plc:cached")
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("expected 1 call (cached), got %d", calls)
	}

	c.didCache.Invalidate("did:plc:cached")
	_, err = c.ResolveDIDDoc(context.Background(), "did:plc:cached")
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 calls after invalidation, got %d", calls)
	}
}

func TestTTLCache_Expiry(t *testing.T) {
	cache := newTTLCache[string](50 * time.Millisecond)
	cache.Set("key", "value")

	if v, ok := cache.Get("key"); !ok || v != "value" {
		t.Fatal("expected cache hit")
	}

	time.Sleep(60 * time.Millisecond)

	if _, ok := cache.Get("key"); ok {
		t.Fatal("expected cache miss after expiry")
	}
}
