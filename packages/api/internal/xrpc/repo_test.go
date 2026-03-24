package xrpc

import "testing"

func TestBuildWebURL(t *testing.T) {
	tests := []struct {
		owner, repo, recordType, rkey string
		want                          string
	}{
		{"alice.test", "myrepo", "repo", "", "https://tangled.sh/alice.test/myrepo"},
		{"alice.test", "myrepo", "issue", "123", "https://tangled.sh/alice.test/myrepo/issues/123"},
		{"alice.test", "myrepo", "pull", "456", "https://tangled.sh/alice.test/myrepo/pulls/456"},
		{"alice.test", "myrepo", "issue_comment", "789", "https://tangled.sh/alice.test/myrepo/issues"},
		{"alice.test", "myrepo", "pull_comment", "789", "https://tangled.sh/alice.test/myrepo/pulls"},
		{"alice.test", "", "profile", "", "https://tangled.sh/alice.test"},
		{"@alice.test", "myrepo", "repo", "", "https://tangled.sh/alice.test/myrepo"},
		{"", "myrepo", "repo", "", ""},
		{"alice.test", "", "repo", "", ""},
		{"alice.test", "myrepo", "unknown", "", ""},
	}

	for _, tt := range tests {
		got := BuildWebURL(tt.owner, tt.repo, tt.recordType, tt.rkey)
		if got != tt.want {
			t.Errorf("BuildWebURL(%q, %q, %q, %q) = %q, want %q",
				tt.owner, tt.repo, tt.recordType, tt.rkey, got, tt.want)
		}
	}
}
