package view

import (
	"embed"
	"html/template"
	"io/fs"
	"net/http"
)

//go:embed templates static
var content embed.FS

var pageTemplates map[string]*template.Template

func init() {
	pageTemplates = make(map[string]*template.Template)
	for _, name := range []string{
		"index.html",
		"docs/index.html",
		"docs/search.html",
		"docs/documents.html",
		"docs/health.html",
	} {
		pageTemplates[name] = template.Must(template.New("layout").ParseFS(content,
			"templates/layout.html",
			"templates/"+name,
		))
	}
}

// Handler returns an http.Handler that serves the site pages and static assets.
func Handler() http.Handler {
	mux := http.NewServeMux()

	staticFS, _ := fs.Sub(content, "static")
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(staticFS)))

	mux.HandleFunc("GET /docs/search", renderPage("docs/search.html"))
	mux.HandleFunc("GET /docs/documents", renderPage("docs/documents.html"))
	mux.HandleFunc("GET /docs/health", renderPage("docs/health.html"))
	mux.HandleFunc("GET /docs", renderPage("docs/index.html"))
	mux.HandleFunc("GET /{$}", renderPage("index.html"))

	return mux
}

func renderPage(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tmpl, ok := pageTemplates[name]
		if !ok {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.ExecuteTemplate(w, "layout", nil); err != nil {
			http.Error(w, "template error", http.StatusInternalServerError)
		}
	}
}
