GET {{knot_url}}/xrpc/sh.tangled.repo.getDefaultBranch
[QueryStringParams]
repo: {{route_repo_did}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.name" isString
jsonpath "$.hash" isString
jsonpath "$.when" isString
