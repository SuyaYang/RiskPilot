#!/bin/bash
# Restart the visual demo from Shop. Never resets payment records or invokes capture.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: npm run demo:shop [-- --check | --no-open]

Opens the local Shop and prints the Sandbox walkthrough.
Starts the dev server if necessary; stops only that server when you press Ctrl+C.
--check    Check an existing app and Sandbox configuration without starting/opening anything.
--no-open  Print the URL without launching the browser.
BASE       Optional loopback URL, default http://localhost:3100.
HELP
}

check_only=false
open_browser=true
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --check) check_only=true; open_browser=false ;;
    --no-open) open_browser=false ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; usage; exit 2 ;;
  esac
done

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo_origin="${BASE:-http://localhost:3100}"
if [[ ! "$demo_origin" =~ ^http://(localhost|127\.0\.0\.1):([0-9]{1,5})/?$ ]]; then
  printf 'BASE must be a local HTTP URL, for example http://localhost:3100.\n' >&2
  exit 2
fi
demo_port=$((10#${BASH_REMATCH[2]}))
if (( demo_port < 1 || demo_port > 65535 )); then
  printf 'Invalid local port.\n' >&2
  exit 2
fi
demo_origin="${demo_origin%/}"
cd "$project_dir"
command -v curl >/dev/null || { printf 'curl is required.\n' >&2; exit 1; }
command -v python3 >/dev/null || { printf 'Python 3 is required for the health checks.\n' >&2; exit 1; }

is_ready() {
  curl --noproxy '*' --connect-timeout 1 --max-time "${1:-2}" -fsS "$demo_origin/api/health" 2>/dev/null |
    python3 -c 'import json,sys; j=json.load(sys.stdin); sys.exit(0 if j.get("status")=="ok" and j.get("mode")=="fictional-demo" else 1)' 2>/dev/null
}

dev_pid=""
cleanup() {
  if [[ -n "$dev_pid" ]] && kill -0 "$dev_pid" 2>/dev/null; then
    kill "$dev_pid" 2>/dev/null || true
    wait "$dev_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! is_ready 5; then
  if "$check_only"; then
    printf 'The repaired app is not reachable at %s.\n' "$demo_origin" >&2
    exit 1
  fi
  if [[ ! -f node_modules/next/dist/bin/next ]]; then
    printf 'Dependencies missing. Run npm ci in this project first.\n' >&2
    exit 1
  fi
  printf 'Starting RiskPilot at %s...\n' "$demo_origin"
  APP_ORIGIN="$demo_origin" npm run dev -- --port "$demo_port" &
  dev_pid=$!
  ready=false
  for ((attempt=0; attempt<30; attempt++)); do
    if is_ready 1; then ready=true; break; fi
    if ! kill -0 "$dev_pid" 2>/dev/null; then
      printf 'Dev server exited. Check the startup error above.\n' >&2
      exit 1
    fi
    sleep 0.25
  done
  if ! "$ready"; then printf 'App did not become ready.\n' >&2; exit 1; fi
fi

if ! curl --noproxy '*' --max-time 10 -fsS "$demo_origin/api/config" |
  python3 -c 'import json,sys; j=json.load(sys.stdin); sys.exit(0 if j.get("paypal") is True else 1)'; then
  printf 'PayPal Sandbox is not configured. Fill the matching Sandbox keys in .env and restart the app.\n' >&2
  exit 1
fi

printf '\nSandbox demo: %s/shop\n' "$demo_origin"
cat <<'STEPS'
1. Choose Sam in the top-right demo selector.
2. Aero 14 Laptop ($900): Compare payment scenarios.
3. Continue with PayPal Sandbox.
4. In the Sandbox buyer window: select a method, then Review Order.
5. Back in RiskPilot: compare projected cash, buffer and goal delays.
6. Stop at Make payment to preview. Clicking it explicitly captures the Sandbox payment.

Forecast options are estimates; they do not change the method selected in PayPal.
This launcher never captures a payment and preserves existing demo/payment records.
STEPS

if "$open_browser"; then
  if command -v open >/dev/null; then
    open "$demo_origin/shop"
  elif command -v xdg-open >/dev/null; then
    xdg-open "$demo_origin/shop"
  else
    printf 'Open the URL above in your browser.\n'
  fi
fi
if [[ -n "$dev_pid" ]]; then
  printf '\nKeep this terminal open. Press Ctrl+C to stop this dev server.\n'
  wait "$dev_pid"
fi
