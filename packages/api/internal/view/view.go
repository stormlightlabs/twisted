package view

import (
	"embed"
	"html/template"
	"io/fs"
	"net/http"
)

//go:embed templates static api-docs.json
var content embed.FS

var pageTemplates map[string]*template.Template

func init() {
	pageTemplates = make(map[string]*template.Template)

	for _, name := range []string{
		"index.html",
	} {
		pageTemplates[name] = template.Must(template.New("layout").ParseFS(content,
			"templates/layout.html",
			"templates/"+name,
		))
	}

	for _, name := range []string{
		"docs/index.html",
		"docs/search.html",
		"docs/documents.html",
		"docs/health.html",
		"docs/actors.html",
		"docs/issues.html",
		"docs/pulls.html",
		"docs/identity.html",
		"docs/activity.html",
		"docs/profiles.html",
		"docs/xrpc.html",
	} {
		pageTemplates[name] = template.Must(template.New("layout").ParseFS(content,
			"templates/layout.html",
			"templates/partials/doc-entry.html",
			"templates/"+name,
		))
	}
}

// Handler returns an http.Handler that serves the site pages and static assets.
func Handler() http.Handler {
	mux := http.NewServeMux()

	staticFS, _ := fs.Sub(content, "static")
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(staticFS)))

	mux.HandleFunc("GET /docs/search", renderDocPage("docs/search.html", "search"))
	mux.HandleFunc("GET /docs/documents", renderDocPage("docs/documents.html", "documents"))
	mux.HandleFunc("GET /docs/health", renderDocPage("docs/health.html", "health"))
	mux.HandleFunc("GET /docs/actors", renderDocPage("docs/actors.html", "actors"))
	mux.HandleFunc("GET /docs/issues", renderDocPage("docs/issues.html", "issues"))
	mux.HandleFunc("GET /docs/pulls", renderDocPage("docs/pulls.html", "pulls"))
	mux.HandleFunc("GET /docs/identity", renderDocPage("docs/identity.html", "identity"))
	mux.HandleFunc("GET /docs/activity", renderDocPage("docs/activity.html", "activity"))
	mux.HandleFunc("GET /docs/profiles", renderDocPage("docs/profiles.html", "profiles"))
	mux.HandleFunc("GET /docs/xrpc", renderDocPage("docs/xrpc.html", "proxy"))
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

func renderDocPage(name, page string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tmpl, ok := pageTemplates[name]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.ExecuteTemplate(w, "layout", PageDocs(page)); err != nil {
			http.Error(w, "template error", http.StatusInternalServerError)
		}
	}
}
