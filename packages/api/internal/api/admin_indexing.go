package api

import (
	"encoding/json"
	"net/http"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

func (s *Server) handleAdminIndexingJobs(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAdmin(w, r) {
		return
	}
	limit, err := intParam(r, "limit", 50)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "limit must be numeric"))
		return
	}
	offset, err := intParam(r, "offset", 0)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "offset must be numeric"))
		return
	}
	jobs, err := s.store.ListIndexingJobs(r.Context(), store.IndexingJobFilter{
		Status:     r.URL.Query().Get("status"),
		Source:     r.URL.Query().Get("source"),
		DocumentID: r.URL.Query().Get("document"),
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorBody("db_error", "failed to list jobs"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs, "limit": limit, "offset": offset})
}

func (s *Server) handleAdminIndexingAudit(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAdmin(w, r) {
		return
	}
	limit, err := intParam(r, "limit", 50)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "limit must be numeric"))
		return
	}
	offset, err := intParam(r, "offset", 0)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "offset must be numeric"))
		return
	}
	entries, err := s.store.ListIndexingAudit(r.Context(), store.IndexingAuditFilter{
		Source:     r.URL.Query().Get("source"),
		Decision:   r.URL.Query().Get("decision"),
		DocumentID: r.URL.Query().Get("document"),
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorBody("db_error", "failed to list audit"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"audit": entries, "limit": limit, "offset": offset})
}

func (s *Server) handleAdminIndexingEnqueue(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAdmin(w, r) {
		return
	}
	var body struct {
		URI   string         `json:"uri"`
		CID   string         `json:"cid"`
		Value map[string]any `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_body", "expected JSON body"))
		return
	}
	if body.URI == "" || body.CID == "" || body.Value == nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_body", "uri, cid, and value are required"))
		return
	}
	s.enqueueRecordForIndexing(r.Context(), store.IndexSourceAdmin, body.URI, body.CID, body.Value)
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (s *Server) authorizeAdmin(w http.ResponseWriter, r *http.Request) bool {
	if s.cfg.AdminAuthToken == "" {
		return true
	}
	token := r.Header.Get("Authorization")
	if token == "Bearer "+s.cfg.AdminAuthToken {
		return true
	}
	writeJSON(w, http.StatusUnauthorized, errorBody("unauthorized", "invalid admin token"))
	return false
}
