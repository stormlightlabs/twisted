GET {{bobbin_url}}/xrpc/com.bad-example.identity.resolveMiniDoc
[QueryStringParams]
identifier: {{handle}}

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.did" == "{{actor_did}}"
jsonpath "$.handle" == "{{handle}}"
jsonpath "$.pds" isString
jsonpath "$.signing_key" isString
