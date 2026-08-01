GET {{bobbin_url}}/xrpc/sh.tangled.repo.countRepos
[QueryStringParams]
subject: {{actor_did}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.count" isInteger
jsonpath "$.distinctAuthors" isInteger
