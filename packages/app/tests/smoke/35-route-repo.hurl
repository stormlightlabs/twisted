GET {{bobbin_url}}/xrpc/sh.tangled.repo.getRepo
[QueryStringParams]
repo: {{route_repo_uri}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.uri" == "{{route_repo_uri}}"
jsonpath "$.value.repoDid" == "{{route_repo_did}}"
jsonpath "$.value.name" isString
