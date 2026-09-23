#!/usr/bin/env bash
# Llama al API del dashboard con el token de dashboard/.env.local.
#
# Uso:
#   api.sh GET  /api/clients
#   api.sh GET  /api/clients/<slug>
#   api.sh PATCH /api/clients/<slug> '{"gmailLabelId":"Label_123"}'
#   api.sh POST /api/clients/<slug>/snapshots '{"status":"green","summary":"..."}'
#   api.sh POST /api/clients/<slug>/notes '{"body":"..."}'
#   api.sh POST /api/clients/<slug>/snapshots @/ruta/al/snapshot.json
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="$here/../../dashboard/.env.local"
[ -f "$env_file" ] || { echo "No existe $env_file" >&2; exit 1; }
set -a; # shellcheck disable=SC1090
source "$env_file"; set +a

: "${DASHBOARD_URL:?Falta DASHBOARD_URL en .env.local}"
: "${INGEST_TOKEN:?Falta INGEST_TOKEN en .env.local}"

method="${1:?método (GET|POST|PATCH)}"
path="${2:?ruta, por ejemplo /api/clients}"
body="${3:-}"

args=(-sS -X "$method" "${DASHBOARD_URL%/}$path"
  -H "Authorization: Bearer $INGEST_TOKEN"
  -H "Content-Type: application/json"
  -w '\n%{http_code}\n')
[ -n "$body" ] && args+=(--data-binary "$body")

out="$(curl "${args[@]}")"
code="$(printf '%s' "$out" | tail -n1)"
printf '%s\n' "$out" | sed '$d'
[ "$code" -lt 400 ] || { echo "HTTP $code" >&2; exit 1; }
