GET {{bobbin_url}}/xrpc/sh.tangled.repo.getDefaultBranch
[QueryStringParams]
repo: {{repo_uri}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.name" isString
jsonpath "$.hash" isString
jsonpath "$.when" isString
