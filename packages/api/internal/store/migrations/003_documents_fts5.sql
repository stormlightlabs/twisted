CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5 (
    id UNINDEXED,
    title,
    body,
    summary,
    repo_name,
    author_handle,
    tags_json,
    tokenize = 'unicode61'
);

DELETE FROM documents_fts;

INSERT INTO documents_fts (id, title, body, summary, repo_name, author_handle, tags_json)
SELECT d.id,
       COALESCE(d.title, ''),
       COALESCE(d.body, ''),
       COALESCE(d.summary, ''),
       COALESCE(d.repo_name, ''),
       COALESCE(d.author_handle, ''),
       COALESCE(d.tags_json, '')
FROM documents d
WHERE d.deleted_at IS NULL;
