function searchApp() {
  const TANGLED_BASE = "https://tangled.org";

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
    toastMessage: "",
    toastVisible: false,
    toastTimer: null,

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

    resultMode(r) {
      return this.resolveResult(r).mode;
    },

    resultURL(r) {
      return this.resolveResult(r).url;
    },

    warningMessage(r) {
      return this.resolveResult(r).warning;
    },

    resolveResult(r) {
      const parsed = this.parseATURI(r.at_uri);
      const author = this.normalizeOwner(r.author_handle) || this.normalizeSegment(r.did) || parsed.did;
      const repoOwner = this.normalizeOwner(r.repo_owner_handle) || author;
      const repoName = this.normalizeSegment(r.repo_name);

      if (r.record_type === "issue") {
        if (!r.at_uri) {
          return {
            mode: "none",
            url: "",
            warning: "This issue is missing its AT URI, so Twister cannot copy or link it yet.",
          };
        }
        return { mode: "copy", url: "", warning: "" };
      }

      if (r.record_type === "string") {
        const owner = author || parsed.did;
        const rkey = parsed.rkey;
        const url = r.web_url || (owner && rkey ? this.buildTangledURL("strings", owner, rkey) : "");
        const warning = url ? "" : "This string is indexed from AT Protocol, but Tangled no longer has a page for it.";
        return { mode: url ? "link" : "none", url, warning };
      }

      if (r.web_url) {
        return { mode: "link", url: r.web_url, warning: "" };
      }

      let url = "";
      switch (r.record_type) {
        case "profile":
          url = author ? this.buildTangledURL(author) : "";
          break;
        case "repo":
          url = repoOwner && repoName ? this.buildTangledURL(repoOwner, repoName) : "";
          break;
        case "issue_comment":
          url = repoOwner && repoName ? this.buildTangledURL(repoOwner, repoName, "issues") : "";
          break;
        case "pull":
        case "pull_comment":
          url = repoOwner && repoName ? this.buildTangledURL(repoOwner, repoName, "pulls") : "";
          break;
      }

      return url
        ? { mode: "link", url, warning: "" }
        : {
            mode: "none",
            url: "",
            warning: "This record is indexed from AT Protocol, but Tangled does not currently expose a page for it.",
          };
    },

    async copyIssueATURI(r) {
      if (!r.at_uri) {
        this.showToast("Issue AT URI is unavailable.");
        return;
      }

      try {
        await this.writeClipboard(r.at_uri);
        this.showToast("Issue AT URI copied.");
      } catch (_) {
        this.showToast("Could not copy the issue AT URI.");
      }
    },

    async writeClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(input);
      if (!copied) throw new Error("copy failed");
    },

    showToast(message) {
      this.toastMessage = message;
      this.toastVisible = true;
      if (this.toastTimer) window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => {
        this.toastVisible = false;
      }, 1800);
    },

    buildTangledURL() {
      const segments = Array.from(arguments)
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment));
      return TANGLED_BASE + "/" + segments.join("/");
    },

    normalizeOwner(owner) {
      return owner ? owner.replace(/^@+/, "").trim() : "";
    },

    normalizeSegment(segment) {
      return segment ? segment.trim() : "";
    },

    parseATURI(uri) {
      if (!uri || !uri.startsWith("at://")) return { did: "", collection: "", rkey: "" };
      const parts = uri.slice("at://".length).split("/");
      const did = parts[0] || "";
      const collection = parts[1] || "";
      const rkey = parts.slice(2).join("/");
      return { did, collection, rkey };
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
