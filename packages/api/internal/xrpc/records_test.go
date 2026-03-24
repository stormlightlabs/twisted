package xrpc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetRecord(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/xrpc/com.atproto.repo.getRecord" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("repo") != "did:plc:test" || q.Get("collection") != "sh.tangled.repo" || q.Get("rkey") != "abc" {
			t.Errorf("unexpected params: %v", q)
		}
		json.NewEncoder(w).Encode(GetRecordResponse{
			URI:   "at://did:plc:test/sh.tangled.repo/abc",
			CID:   "bafytest",
			Value: map[string]any{"name": "myrepo"},
		})
	}))
	defer srv.Close()

	c := NewClient()
	resp, err := c.GetRecord(context.Background(), srv.URL, "did:plc:test", "sh.tangled.repo", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if resp.CID != "bafytest" {
		t.Errorf("expected CID bafytest, got %s", resp.CID)
	}
	name, _ := resp.Value["name"].(string)
	if name != "myrepo" {
		t.Errorf("expected name myrepo, got %s", name)
	}
}

func TestListRecords(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(ListRecordsResponse{
			Records: []ListRecordEntry{
				{URI: "at://did:plc:test/col/1", Value: map[string]any{"subject": "did:plc:a"}},
				{URI: "at://did:plc:test/col/2", Value: map[string]any{"subject": "did:plc:b"}},
			},
		})
	}))
	defer srv.Close()

	c := NewClient()
	resp, err := c.ListRecords(context.Background(), srv.URL, "did:plc:test", "sh.tangled.graph.follow", 100, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Records) != 2 {
		t.Errorf("expected 2 records, got %d", len(resp.Records))
	}
}

func TestListAllRecords_Pagination(t *testing.T) {
	page := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page++
		resp := ListRecordsResponse{}
		if page == 1 {
			resp.Cursor = "page2"
			resp.Records = []ListRecordEntry{{URI: "at://1"}}
		} else {
			resp.Records = []ListRecordEntry{{URI: "at://2"}}
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := NewClient()
	all, err := c.ListAllRecords(context.Background(), srv.URL, "did:plc:test", "test.col")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Errorf("expected 2 records across pages, got %d", len(all))
	}
	if page != 2 {
		t.Errorf("expected 2 pages, got %d", page)
	}
}

func TestGetRecord_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer srv.Close()

	c := NewClient()
	_, err := c.GetRecord(context.Background(), srv.URL, "did:plc:test", "col", "rkey")
	if err == nil {
		t.Fatal("expected error")
	}
}
