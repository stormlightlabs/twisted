package view

import (
	_ "embed"
	"encoding/json"
)

// DocParam describes a single path or query parameter for an endpoint.
type DocParam struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Required    bool   `json:"required,omitempty"`
	Description string `json:"description,omitempty"`
}

// DocEntry describes a single API endpoint.
type DocEntry struct {
	Page        string     `json:"page"`
	Route       string     `json:"route"`
	Method      string     `json:"method"`
	Summary     string     `json:"summary"`
	Details     string     `json:"details,omitempty"`
	PathParams  []DocParam `json:"pathParams,omitempty"`
	QueryParams []DocParam `json:"queryParams,omitempty"`
}

//go:embed api-docs.json
var apiDocFile []byte

var docsByPage map[string][]DocEntry

func init() {
	var all []DocEntry
	if err := json.Unmarshal(apiDocFile, &all); err != nil {
		panic("api-docs.json: " + err.Error())
	}
	docsByPage = make(map[string][]DocEntry)
	for _, e := range all {
		docsByPage[e.Page] = append(docsByPage[e.Page], e)
	}
}

// PageDocs returns the doc entries for a given page key.
func PageDocs(page string) []DocEntry {
	return docsByPage[page]
}
