package xrpc

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestCall_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/com.example.method" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("key") != "val" {
			t.Errorf("unexpected query: %s", r.URL.RawQuery)
		}
		w.WriteHeader(200)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	c := NewClient()
	body, err := c.Call(context.Background(), srv.URL, "com.example.method", url.Values{"key": {"val"}})
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()

	var resp map[string]bool
	json.NewDecoder(body).Decode(&resp)
	if !resp["ok"] {
		t.Error("expected ok=true")
	}
}

func TestCall_404_ReturnsNotFoundError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer srv.Close()

	c := NewClient()
	_, err := c.Call(context.Background(), srv.URL, "com.example.notfound", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	var nfe *NotFoundError
	if !errors.As(err, &nfe) {
		t.Errorf("expected NotFoundError, got %T: %v", err, err)
	}
}

func TestCall_429_ReturnsRateLimitError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(429)
	}))
	defer srv.Close()

	c := NewClient()
	_, err := c.Call(context.Background(), srv.URL, "com.example.ratelimit", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	var rle *RateLimitError
	if !errors.As(err, &rle) {
		t.Fatalf("expected RateLimitError, got %T: %v", err, err)
	}
	if rle.RetryAfter != 30*time.Second {
		t.Errorf("expected RetryAfter=30s, got %s", rle.RetryAfter)
	}
}

func TestCall_500_ReturnsXRPCError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte(`{"message":"internal error"}`))
	}))
	defer srv.Close()

	c := NewClient()
	_, err := c.Call(context.Background(), srv.URL, "com.example.error", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	var xe *XRPCError
	if !errors.As(err, &xe) {
		t.Fatalf("expected XRPCError, got %T: %v", err, err)
	}
	if xe.StatusCode != 500 {
		t.Errorf("expected status 500, got %d", xe.StatusCode)
	}
	if xe.Message != "internal error" {
		t.Errorf("expected message 'internal error', got %q", xe.Message)
	}
}

func TestParseRetryAfter(t *testing.T) {
	if d := parseRetryAfter(""); d != 0 {
		t.Errorf("empty: expected 0, got %s", d)
	}
	if d := parseRetryAfter("60"); d != 60*time.Second {
		t.Errorf("numeric: expected 60s, got %s", d)
	}
}
