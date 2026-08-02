GET {{bobbin_url}}/xrpc/sh.tangled.search.query
[QueryStringParams]
q: twisted
author: {{actor_did}}
limit: 1

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.hits" isCollection
