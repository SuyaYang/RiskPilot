#!/bin/bash
# End-to-end PayPal Sandbox check against the running app (npm run dev in another terminal).
# Creates a decision for the demo persona, creates a real Sandbox order, lets you approve it as the
# Sandbox buyer, captures it, and shows the updated forecast. Prints no secrets.
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp)"
METHOD="${1:-pay_in_4}"
curl -sf "$BASE/api/config" >/dev/null || { echo "App is not running. Start it with: npm run dev"; exit 1; }
py() { python3 -c "import sys,json; j=json.load(sys.stdin); $1"; }

curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/reset" >/dev/null
curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/personas" -H 'content-type: application/json' -d '{"id":"alex"}' >/dev/null
echo "1) Assessing the \$900 laptop for Alex..."
DEC=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/decisions" -H 'content-type: application/json' -d '{"productId":"aero-14"}')
echo "$DEC" | py "d=j['decision']; print('   recommended:', d['recommendedMethod']); print('   explanation (' + d['explanation']['source'] + '):', d['explanation']['text'])"
DID=$(echo "$DEC" | py "print(j['decision']['id'])")

echo "2) Creating a PayPal Sandbox order for option: $METHOD"
ORD=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/orders" -H 'content-type: application/json' -d "{\"decisionId\":\"$DID\",\"method\":\"$METHOD\"}")
OID=$(echo "$ORD" | py "print(j.get('id') or ('ERROR: ' + j.get('error','unknown')))")
case "$OID" in ERROR*) echo "   $OID"; exit 1;; SIM-*) echo "   Simulated order: PayPal keys are not loaded. Restart npm run dev after editing .env."; exit 1;; esac
echo "   order id: $OID"
URL="https://www.sandbox.paypal.com/checkoutnow?token=$OID"
echo "3) Approve it in the browser as the Sandbox PERSONAL (buyer) account:"
echo "   $URL"
command -v open >/dev/null && open "$URL" || true
read -r -p "   Press Enter after you clicked Pay / Continue in PayPal... "

echo "4) Capturing..."
CAP=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/orders/$OID/capture")
echo "$CAP" | py "print('   result:', j.get('status'), '| duplicate:', j.get('duplicate'), '|', j.get('error',''))"
echo "5) Capturing again (must not double count)..."
curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/orders/$OID/capture" | py "print('   result:', j.get('status'), '| duplicate:', j.get('duplicate'))"
echo "6) Updated forecast:"
curl -s -b "$JAR" "$BASE/api/snapshot" | py "
f=j['forecast']; print('   purchases recorded:', len(j['purchases']))
print('   upcoming payments:', ', '.join(p['date']+' \$'+str(round(p['amount'])) for p in j['upcomingPayments']) or 'none')
print('   lowest balance: \$'+str(round(f['minBalance'])), 'on', f['minBalanceDate'], '| risk:', f['risk'])"
rm -f "$JAR"
