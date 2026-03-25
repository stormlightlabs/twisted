package api

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
	"tangled.org/desertthunder.dev/twister/internal/constellation"
)

var proxyHTTPClient = &http.Client{Timeout: 30 * time.Second}

// isValidHost checks that a host string is safe to use in an upstream URL.
// Rejects empty strings, anything with path separators or whitespace.
func isValidHost(host string) bool {
	return len(host) > 0 && len(host) < 256 &&
		!strings.ContainsAny(host, "/ \t\r\n")
}

// proxyHTTP fetches upstreamURL and writes the response (headers + body) to w verbatim.
func (s *Server) proxyHTTP(w http.ResponseWriter, r *http.Request, upstreamURL string) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstreamURL, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorBody("proxy_error", "failed to build upstream request"))
		return
	}
	if accept := r.Header.Get("Accept"); accept != "" {
		req.Header.Set("Accept", accept)
	}

	resp, err := proxyHTTPClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("proxy_error", "upstream request failed"))
		return
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// handleKnotProxy proxies GET requests to a Tangled knot's XRPC endpoint.
// Route: GET /xrpc/knot/{knotHost}/{nsid}
func (s *Server) handleKnotProxy(w http.ResponseWriter, r *http.Request) {
	knotHost := r.PathValue("knotHost")
	nsid := r.PathValue("nsid")
	if !isValidHost(knotHost) {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "invalid knot host"))
		return
	}
	upstream := fmt.Sprintf("https://%s/xrpc/%s", knotHost, nsid)
	if r.URL.RawQuery != "" {
		upstream += "?" + r.URL.RawQuery
	}
	s.proxyHTTP(w, r, upstream)
}

// handlePdsProxy proxies GET requests to an AT Protocol PDS XRPC endpoint.
// Route: GET /xrpc/pds/{pds}/{nsid}
func (s *Server) handlePdsProxy(w http.ResponseWriter, r *http.Request) {
	pds := r.PathValue("pds")
	nsid := r.PathValue("nsid")
	if !isValidHost(pds) {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "invalid PDS host"))
		return
	}
	upstream := fmt.Sprintf("https://%s/xrpc/%s", pds, nsid)
	if r.URL.RawQuery != "" {
		upstream += "?" + r.URL.RawQuery
	}
	s.proxyHTTP(w, r, upstream)
}

// handleBskyProxy proxies GET requests to the Bluesky public API.
// Route: GET /xrpc/bsky/{nsid}
func (s *Server) handleBskyProxy(w http.ResponseWriter, r *http.Request) {
	nsid := r.PathValue("nsid")
	upstream := fmt.Sprintf("https://public.api.bsky.app/xrpc/%s", nsid)
	if r.URL.RawQuery != "" {
		upstream += "?" + r.URL.RawQuery
	}
	s.proxyHTTP(w, r, upstream)
}

// handleResolveHandle proxies handle → DID resolution through bsky.social.
// Route: GET /identity/resolve?handle=...
func (s *Server) handleResolveHandle(w http.ResponseWriter, r *http.Request) {
	upstream := "https://bsky.social/xrpc/com.atproto.identity.resolveHandle"
	if r.URL.RawQuery != "" {
		upstream += "?" + r.URL.RawQuery
	}
	s.proxyHTTP(w, r, upstream)
}

// handleDidDocument fetches a DID document from plc.directory (did:plc) or
// the well-known endpoint (did:web) and proxies the response.
// Route: GET /identity/did/{did}
func (s *Server) handleDidDocument(w http.ResponseWriter, r *http.Request) {
	did := r.PathValue("did")
	var docURL string
	switch {
	case strings.HasPrefix(did, "did:plc:"):
		docURL = fmt.Sprintf("https://plc.directory/%s", did)
	case strings.HasPrefix(did, "did:web:"):
		host := strings.TrimPrefix(did, "did:web:")
		docURL = fmt.Sprintf("https://%s/.well-known/did.json", host)
	default:
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "unsupported DID method"))
		return
	}
	s.proxyHTTP(w, r, docURL)
}

// handleBacklinksCount returns the Constellation backlinks count for a subject/source pair.
// Route: GET /backlinks/count?subject=...&source=...
func (s *Server) handleBacklinksCount(w http.ResponseWriter, r *http.Request) {
	if s.constellation == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorBody("not_configured", "constellation is not configured"))
		return
	}
	subject := r.URL.Query().Get("subject")
	source := r.URL.Query().Get("source")
	if subject == "" || source == "" {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "subject and source are required"))
		return
	}
	n, err := s.constellation.GetBacklinksCount(r.Context(), constellation.BacklinksParams{
		Subject: subject,
		Source:  source,
	})
	if err != nil {
		s.log.Debug("backlinks count failed", slog.String("error", err.Error()))
		writeJSON(w, http.StatusBadGateway, errorBody("constellation_error", "failed to fetch backlinks count"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"count": n})
}

// handleActivityStream accepts a WebSocket connection and proxies it to the
// Jetstream firehose, forwarding all query parameters (wantedCollections, cursor, etc.)
// Route: GET /activity/stream
func (s *Server) handleActivityStream(w http.ResponseWriter, r *http.Request) {
	clientConn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		s.log.Debug("activity stream: accept failed", slog.String("error", err.Error()))
		return
	}
	defer clientConn.CloseNow()

	jetstreamURL := "wss://jetstream2.us-east.bsky.network/subscribe"
	if r.URL.RawQuery != "" {
		jetstreamURL += "?" + r.URL.RawQuery
	}

	ctx := r.Context()
	jetstreamConn, _, err := websocket.Dial(ctx, jetstreamURL, nil)
	if err != nil {
		s.log.Debug("activity stream: jetstream dial failed", slog.String("error", err.Error()))
		_ = clientConn.Close(websocket.StatusBadGateway, "failed to connect to upstream")
		return
	}
	defer jetstreamConn.CloseNow()

	for {
		msgType, msg, err := jetstreamConn.Read(ctx)
		if err != nil {
			return
		}
		if err := clientConn.Write(ctx, msgType, msg); err != nil {
			return
		}
	}
}
