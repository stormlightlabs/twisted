GET {{knot_url}}/xrpc/sh.tangled.repo.tree
[QueryStringParams]
repo: {{route_repo_did}}
ref: HEAD
path:

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.ref" isString
jsonpath "$.files" isCollection
