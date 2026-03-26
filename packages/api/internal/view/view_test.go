package view

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerRendersSearchHome(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Search Tangled") {
		t.Fatalf("expected search home content, got body %q", body)
	}
	if !strings.Contains(body, "GET /actors/desertthunder.dev") {
		t.Fatalf("expected search empty state example, got body %q", body)
	}
	if strings.Contains(body, "Health Endpoints") {
		t.Fatalf("expected search home page, got health page content")
	}
}

func TestHandlerRendersDocsIndex(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec := httptest.NewRecorder()

	Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "API Documentation") {
		t.Fatalf("expected docs page content, got body %q", body)
	}
	if strings.Contains(body, "template error") {
		t.Fatalf("expected docs page render, got template error")
	}
}
