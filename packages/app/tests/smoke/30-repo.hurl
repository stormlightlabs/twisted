GET {{bobbin_url}}/xrpc/sh.tangled.repo.getRepo
[QueryStringParams]
repo: {{repo_uri}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.uri" == "{{repo_uri}}"
jsonpath "$.value['$type']" == "sh.tangled.repo"
jsonpath "$.value.repoDid" == "{{repo_did}}"
