#!/bin/bash
# Prompts for keys without echoing them and writes them into .env (which git ignores).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env

set_var() {
  local name="$1" value="$2"
  python3 - "$name" "$value" <<'PY'
import sys
name, value = sys.argv[1], sys.argv[2].strip()
lines = open('.env').read().splitlines()
out, found = [], False
for l in lines:
    if l.split('=', 1)[0] == name:
        out.append(f"{name}={value}"); found = True
    else:
        out.append(l)
if not found:
    out.append(f"{name}={value}")
open('.env', 'w').write("\n".join(out) + "\n")
PY
}

ask() {
  local name="$1" prompt="$2" value
  read -r -s -p "$prompt (input hidden, Enter to skip): " value; echo
  if [ -n "$value" ]; then set_var "$name" "$value"; echo "  saved $name (${#value} characters)"; else echo "  skipped $name"; fi
}

case "${1:-paypal}" in
  paypal)
    read -r -s -p "PayPal Sandbox Client ID (starts with A, input hidden): " cid; echo
    if [ -n "$cid" ]; then set_var PAYPAL_CLIENT_ID "$cid"; set_var NEXT_PUBLIC_PAYPAL_CLIENT_ID "$cid"; echo "  saved client ID (${#cid} characters)"; fi
    ask PAYPAL_CLIENT_SECRET "PayPal Sandbox Secret"
    ;;
  plaid) ask PLAID_CLIENT_ID "Plaid client_id"; ask PLAID_SECRET "Plaid Sandbox secret" ;;
  gemini) ask GEMINI_API_KEY "Gemini API key" ;;
  supabase)
    ask NEXT_PUBLIC_SUPABASE_URL "Supabase project URL"
    ask NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "Supabase publishable key"
    ask SUPABASE_SERVER_SECRET_KEY "Supabase secret key"
    ask DATABASE_URL "Supabase Postgres connection string"
    ;;
  *) echo "usage: scripts/set-keys.sh [paypal|plaid|gemini|supabase]"; exit 1 ;;
esac
