GET {{knot_url}}/xrpc/sh.tangled.repo.languages
[QueryStringParams]
repo: {{route_repo_did}}
ref: HEAD

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.ref" isString
jsonpath "$.languages" isCollection
