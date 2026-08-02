GET {{bobbin_url}}/xrpc/sh.tangled.repo.languages
[QueryStringParams]
repo: {{repo_uri}}
ref: HEAD

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.ref" isString
jsonpath "$.languages" isCollection
