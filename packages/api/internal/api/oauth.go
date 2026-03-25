package api

import (
	"encoding/json"
	"net/http"
)

type OAuthClientMetadata struct {
	ClientID                      string   `json:"client_id"`
	ClientName                    string   `json:"client_name"`
	ClientURI                     string   `json:"client_uri,omitempty"`
	LogoURI                       string   `json:"logo_uri,omitempty"`
	TosURI                        string   `json:"tos_uri,omitempty"`
	PolicyURI                     string   `json:"policy_uri,omitempty"`
	RedirectURIs                  []string `json:"redirect_uris"`
	Scope                         string   `json:"scope"`
	GrantTypes                    []string `json:"grant_types"`
	ResponseTypes                 []string `json:"response_types"`
	ApplicationType               string   `json:"application_type"`
	DpopBoundAccessTokens         bool     `json:"dpop_bound_access_tokens"`
	TokenEndpointAuthMethod       string   `json:"token_endpoint_auth_method"`
	DpopSigningAlgValuesSupported []string `json:"dpop_signing_alg_values_supported,omitempty"`
}

func (s *Server) handleOAuthClientMetadata(w http.ResponseWriter, r *http.Request) {
	if s.cfg.OAuthClientID == "" {
		writeJSON(w, http.StatusNotFound, errorBody("not_configured", "OAuth is not configured on this server"))
		return
	}

	metadata := OAuthClientMetadata{
		ClientID:                      s.cfg.OAuthClientID,
		ClientName:                    "Twisted",
		ClientURI:                     s.cfg.OAuthClientID,
		RedirectURIs:                  s.cfg.OAuthRedirectURIs,
		Scope:                         "atproto",
		GrantTypes:                    []string{"authorization_code", "refresh_token"},
		ResponseTypes:                 []string{"code"},
		ApplicationType:               "native",
		DpopBoundAccessTokens:         true,
		TokenEndpointAuthMethod:       "none",
		DpopSigningAlgValuesSupported: []string{"ES256"},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(metadata)
}
