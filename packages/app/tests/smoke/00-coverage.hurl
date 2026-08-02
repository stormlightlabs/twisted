GET {{bobbin_url}}/xrpc/sh.tangled.bobbin.getCoverage

HTTP 200
[Asserts]
header "content-type" startsWith "application/json"
jsonpath "$.ready" isBoolean
jsonpath "$.eventsProcessed" isInteger
jsonpath "$.lastCursor" isInteger
