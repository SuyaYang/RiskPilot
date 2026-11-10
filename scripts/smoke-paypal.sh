#!/bin/bash
# Run against the local app. Uses a fresh browser-equivalent demo workspace, no global reset.
# Requires a real Sandbox PERSONAL buyer approval. No provider secrets are printed.
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
METHOD="${1:-full}"
py() { python3 -c "import sys,json; j=json.load(sys.stdin); $1"; }
CONFIG=$(curl --max-time 10 -fsS -c "$JAR" -b "$JAR" "$BASE/api/config")
echo "$CONFIG" | py "assert j['paypal'], 'PayPal Sandbox keys are missing; this is not a real payment test'"
curl --max-time 10 -fsS -c "$JAR" -b "$JAR" -X POST "$BASE/api/personas" -H 'content-type: application/json' -d '{"id":"alex"}' >/dev/null

echo '1) Assessing the $900 laptop for Alex...'
DEC=$(curl --max-time 40 -fsS -c "$JAR" -b "$JAR" -X POST "$BASE/api/decisions" -H 'content-type: application/json' -d '{"productId":"aero-14"}')
DID=$(echo "$DEC" | py "print(j['decision']['id'])")
echo "2) Creating full-price Sandbox order (comparison: $METHOD)..."
ORD=$(curl --max-time 40 -fsS -c "$JAR" -b "$JAR" -X POST "$BASE/api/paypal/orders" -H 'content-type: application/json' -d "{\"decisionId\":\"$DID\",\"method\":\"$METHOD\"}")
OID=$(echo "$ORD" | py "assert 'id' in j and not j.get('simulated'), j.get('error','Not a Sandbox order'); print(j['id'])")
URL=$(echo "$ORD" | py "print(j.get('approvalUrl') or '')")
if [ -z "$URL" ]; then URL="https://www.sandbox.paypal.com/checkoutnow?token=$OID"; fi
echo '3) Approve in PayPal as the Sandbox PERSONAL buyer:'
echo "   $URL"
command -v open >/dev/null && open "$URL" || true
read -r -p '   Press Enter after approval (early Enter reports payment incomplete)... '

echo '4) Capturing (unapproved orders return immediately after status lookup)...'
CAP=$(curl --max-time 40 -sS -c "$JAR" -b "$JAR" -X POST "$BASE/api/paypal/orders/$OID/capture")
echo "$CAP" | py "print('   status:',j.get('status'),j.get('error','')); assert j.get('status')=='CAPTURED', 'Payment not completed. Finish PayPal approval, then check this same order.'"
echo '5) Duplicate capture must remain idempotent...'
curl --max-time 40 -fsS -b "$JAR" -X POST "$BASE/api/paypal/orders/$OID/capture" | py "assert j['status']=='CAPTURED' and j['duplicate']; print('   duplicate confirmed')"
echo '6) Confirming saved forecast, capture count, and full merchant price...'
curl --max-time 10 -fsS -b "$JAR" "$BASE/api/orders/$OID" | py "assert j['order']['amount']==900; assert j['order']['projectionStatus']=='UPDATED'; assert j['forecastSnapshot']['schemaVersion']=='rp-v1'; print('   versioned forecast saved')"
curl --max-time 10 -fsS -b "$JAR" "$BASE/api/dashboard" | py "assert len(j['purchases'])==1; print('   one purchase recorded; funding:',j['purchases'][0]['fundingStatus']); print('   lowest projection:',j['forecast']['minBalance'])"
