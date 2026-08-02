GET {{bobbin_url}}/xrpc/sh.tangled.repo.tree
[QueryStringParams]
repo: {{repo_uri}}
ref: HEAD
path:

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.ref" isString
jsonpath "$.files" isCollection
