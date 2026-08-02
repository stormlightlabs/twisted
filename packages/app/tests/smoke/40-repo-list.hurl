GET {{bobbin_url}}/xrpc/sh.tangled.repo.listRepos
[QueryStringParams]
subject: {{actor_did}}
limit: 1

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.items" isCollection
