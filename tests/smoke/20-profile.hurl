GET {{bobbin_url}}/xrpc/sh.tangled.actor.getProfile
[QueryStringParams]
actor: {{profile_uri}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.uri" == "{{profile_uri}}"
jsonpath "$.value['$type']" == "sh.tangled.actor.profile"
