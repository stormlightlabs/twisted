function searchApp() {
  return {
    query: "",
    filters: { type: "", author: "", language: "", state: "" },
    results: [],
    offset: 0,
    limit: 20,
    total: 0,
    loading: false,
    searched: false,
    error: null,

    get hasMore() {
      return this.searched && this.offset + this.limit < this.total;
    },

    initFromURL() {
      const p = new URLSearchParams(window.location.search);
      this.query = p.get("q") || "";
      this.filters.type = p.get("type") || "";
      this.filters.author = p.get("author") || "";
      this.filters.language = p.get("language") || "";
      this.filters.state = p.get("state") || "";
      if (this.query) this.doSearch(true);
    },

    buildParams(reset) {
      const p = new URLSearchParams();
      p.set("q", this.query);
      p.set("limit", String(this.limit));
      p.set("offset", String(reset ? 0 : this.offset));
      if (this.filters.type) p.set("type", this.filters.type);
      if (this.filters.author) p.set("author", this.filters.author);
      if (this.filters.language) p.set("language", this.filters.language);
      if (this.filters.state) p.set("state", this.filters.state);
      return p;
    },

    syncURL() {
      const p = new URLSearchParams();
      if (this.query) p.set("q", this.query);
      if (this.filters.type) p.set("type", this.filters.type);
      if (this.filters.author) p.set("author", this.filters.author);
      if (this.filters.language) p.set("language", this.filters.language);
      if (this.filters.state) p.set("state", this.filters.state);
      const qs = p.toString();
      history.replaceState(null, "", qs ? "?" + qs : "/");
    },

    async doSearch(reset) {
      if (!this.query.trim()) return;
      if (reset) {
        this.offset = 0;
        this.results = [];
      }
      this.loading = true;
      this.error = null;
      this.syncURL();

      try {
        const resp = await fetch("/search?" + this.buildParams(reset));
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          this.error = (body && body.message) || "Search request failed (" + resp.status + ")";
          return;
        }
        const data = await resp.json();
        if (reset) {
          this.results = data.results || [];
        } else {
          this.results = this.results.concat(data.results || []);
        }
        this.total = data.total || 0;
        this.searched = true;
      } catch (e) {
        this.error = "Could not reach the API. Is the server running?";
      } finally {
        this.loading = false;
      }
    },

    loadMore() {
      this.offset += this.limit;
      this.doSearch(false);
    },

    canonicalURL(r) {
      const h = r.author_handle || "";
      switch (r.record_type) {
        case "repo":
          return h && r.repo_name ? "https://tangled.org/" + h + "/" + r.repo_name : "#";
        case "issue":
          return h && r.repo_name ? "https://tangled.org/" + h + "/" + r.repo_name + "/issues" : "#";
        case "pull":
          return h && r.repo_name ? "https://tangled.org/" + h + "/" + r.repo_name + "/pulls" : "#";
        case "profile":
          return h ? "https://tangled.org/" + h : "#";
        default:
          return "#";
      }
    },

    relTime(iso) {
      if (!iso) return "";
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + "h ago";
      const days = Math.floor(hrs / 24);
      if (days < 30) return days + "d ago";
      const months = Math.floor(days / 30);
      return months + "mo ago";
    },
  };
}
