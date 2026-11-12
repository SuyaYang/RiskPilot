#!/bin/bash
# Start/check the two local demo sites. Never approve, capture, or reset an order.
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
check_only=false
open_browser=true
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true; open_browser=false ;;
    --no-open) open_browser=false ;;
    --help|-h) printf 'Usage: npm run demo [-- --check | --no-open]\nStarts/checks RiskPilot :3100 and the independent store :3200. Never captures.\n'; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
command -v curl >/dev/null || { printf 'curl is required.\n' >&2; exit 1; }
command -v python3 >/dev/null || { printf 'Python 3 is required.\n' >&2; exit 1; }
export APP_ORIGIN=http://localhost:3100
export RISKPILOT_ORIGIN=http://localhost:3100
export MERCHANT_ORIGIN=http://localhost:3200
export MERCHANT_PORT=3200
web_pid=""
merchant_pid=""
cleanup() {
  for pid in "$merchant_pid" "$web_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
web_ready() {
  curl --noproxy '*' -fsS --connect-timeout 1 --max-time 2 "$APP_ORIGIN/api/health" 2>/dev/null |
    python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("status")=="ok" and d.get("mode")=="fictional-demo" and d.get("checkoutFlow")=="merchant-continue-v1" else 1)' 2>/dev/null
}
merchant_ready() {
  curl --noproxy '*' -fsS --connect-timeout 1 --max-time 2 "$MERCHANT_ORIGIN/api/health" 2>/dev/null |
    python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("flow")=="riskpilot-continue-v1" and d.get("reviewIntent")=="signed-v1" and d.get("reviewOrigin")=="http://localhost:3100" else 1)' 2>/dev/null
}
if ! web_ready; then
  if "$check_only"; then printf 'RiskPilot is not ready at %s.\n' "$APP_ORIGIN" >&2; exit 1; fi
  printf 'Starting RiskPilot at %s...\n' "$APP_ORIGIN"
  node node_modules/next/dist/bin/next dev --port 3100 &
  web_pid=$!
  ready=false
  for ((attempt=0; attempt<80; attempt++)); do
    if web_ready; then ready=true; break; fi
    if ! kill -0 "$web_pid" 2>/dev/null; then break; fi
    sleep 0.25
  done
  if ! "$ready"; then printf 'RiskPilot did not start. If port 3100 is occupied by an older working copy, stop that process first. Check the startup error above.\n' >&2; exit 1; fi
fi
if ! curl --noproxy '*' -fsS --max-time 10 "$APP_ORIGIN/api/config" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("paypal") is True else 1)'; then
  printf 'Configure matching PayPal Sandbox keys in .env, then restart.\n' >&2; exit 1
fi
if ! merchant_ready; then
  if "$check_only"; then printf 'Independent store is not ready at %s.\n' "$MERCHANT_ORIGIN" >&2; exit 1; fi
  printf 'Starting independent store at %s...\n' "$MERCHANT_ORIGIN"
  node --env-file=.env --import tsx merchant-demo/start.ts &
  merchant_pid=$!
  ready=false
  for ((attempt=0; attempt<40; attempt++)); do
    if merchant_ready; then ready=true; break; fi
    if ! kill -0 "$merchant_pid" 2>/dev/null; then break; fi
    sleep 0.25
  done
  if ! "$ready"; then printf 'Independent store did not start. Check its startup error above.\n' >&2; exit 1; fi
fi
printf '\nDemo ready: %s\n' "$MERCHANT_ORIGIN"
cat <<'STEPS'
1. At Northstar Electronics, select Check out with PayPal Sandbox.
2. Use the Sandbox personal buyer; choose a funding method, then Continue / Review Order.
3. RiskPilot opens the purchase impact review. No funds have been captured.
4. Preview cash, buffer and goals. Stop here for an impact-only demonstration.
5. If you choose Confirm and pay, the merchant captures once and returns a verified store receipt.

No browser extension is required. This launcher never captures or resets data.
STEPS
if "$open_browser"; then
  if command -v open >/dev/null; then open "$MERCHANT_ORIGIN";
  elif command -v xdg-open >/dev/null; then xdg-open "$MERCHANT_ORIGIN";
  fi
fi
if [[ -n "$web_pid" || -n "$merchant_pid" ]]; then
  printf '\nKeep this terminal open. Ctrl+C stops only the services started by this command.\n'
  if [[ -n "$merchant_pid" ]]; then wait "$merchant_pid"; else wait "$web_pid"; fi
fi
