package xrpc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveHandle(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/com.atproto.identity.resolveHandle" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		handle := r.URL.Query().Get("handle")
		if handle != "alice.test" {
			t.Errorf("expected handle alice.test, got %s", handle)
		}
		json.NewEncoder(w).Encode(map[string]string{"did": "did:plc:alice"})
	}))
	defer srv.Close()

	c := NewClient(WithIdentityService(srv.URL))
	did, err := c.ResolveHandle(context.Background(), "alice.test")
	if err != nil {
		t.Fatal(err)
	}
	if did != "did:plc:alice" {
		t.Errorf("expected did:plc:alice, got %s", did)
	}
}

func TestResolveHandle_InvalidDID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"did": "not-a-did"})
	}))
	defer srv.Close()

	c := NewClient(WithIdentityService(srv.URL))
	_, err := c.ResolveHandle(context.Background(), "bad.test")
	if err == nil {
		t.Fatal("expected error for invalid DID response")
	}
}
