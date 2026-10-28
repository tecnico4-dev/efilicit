#!/usr/bin/env bash
# Dispara workflow_dispatch en tecnico4-dev/efilicit (ADR 020 / cron externo).
#
# Uso:
#   export GITHUB_TOKEN=ghp_...   # Actions: write + Contents: read
#   ./scripts/dispatch-workflow.sh ingest-catalunya.yml
#   ./scripts/dispatch-workflow.sh ingest-placsp.yml   # usa SYNDICATION
#   ./scripts/dispatch-workflow.sh alerts-match.yml
#   ./scripts/dispatch-workflow.sh alerts-digest.yml
#
# Variables opcionales: REF (default main), SYNDICATION, MAX_PAGES, PAGE_SIZE,
# UPLOAD_STORAGE (true|false), MODE (override).

set -euo pipefail

REPO="${GITHUB_REPO:-tecnico4-dev/efilicit}"
REF="${REF:-main}"
WORKFLOW="${1:-}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "error: set GITHUB_TOKEN" >&2
  exit 2
fi
if [[ -z "$WORKFLOW" ]]; then
  echo "usage: $0 <workflow-file.yml>" >&2
  exit 2
fi

case "$WORKFLOW" in
  ingest-placsp.yml)
    SYNDICATION="${SYNDICATION:-placsp}"
    MODE="${MODE:-live}"
    UPLOAD_STORAGE="${UPLOAD_STORAGE:-true}"
    BODY=$(printf '%s' "{\"ref\":\"$REF\",\"inputs\":{\"syndication\":\"$SYNDICATION\",\"mode\":\"$MODE\",\"upload_storage\":\"$UPLOAD_STORAGE\"}}")
    ;;
  ingest-catalunya.yml)
    MODE="${MODE:-live}"
    MAX_PAGES="${MAX_PAGES:-10}"
    PAGE_SIZE="${PAGE_SIZE:-1000}"
    UPLOAD_STORAGE="${UPLOAD_STORAGE:-true}"
    BODY=$(printf '%s' "{\"ref\":\"$REF\",\"inputs\":{\"mode\":\"$MODE\",\"max_pages\":\"$MAX_PAGES\",\"page_size\":\"$PAGE_SIZE\",\"upload_storage\":\"$UPLOAD_STORAGE\"}}")
    ;;
  ingest-euskadi.yml)
    MODE="${MODE:-live}"
    MAX_PAGES="${MAX_PAGES:-10}"
    UPLOAD_STORAGE="${UPLOAD_STORAGE:-true}"
    BODY=$(printf '%s' "{\"ref\":\"$REF\",\"inputs\":{\"mode\":\"$MODE\",\"max_pages\":\"$MAX_PAGES\",\"upload_storage\":\"$UPLOAD_STORAGE\"}}")
    ;;
  alerts-match.yml)
    MODE="${MODE:-write}"
    BODY=$(printf '%s' "{\"ref\":\"$REF\",\"inputs\":{\"mode\":\"$MODE\"}}")
    ;;
  alerts-digest.yml)
    MODE="${MODE:-write-resend}"
    BODY=$(printf '%s' "{\"ref\":\"$REF\",\"inputs\":{\"mode\":\"$MODE\"}}")
    ;;
  *)
    echo "error: unknown workflow '$WORKFLOW' (edit script or pass a known file)" >&2
    exit 2
    ;;
esac

URL="https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches"
echo "POST $URL"
echo "body: $BODY"

HTTP=$(curl -sS -o /tmp/efilicit-dispatch-body.txt -w "%{http_code}" \
  -X POST "$URL" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -d "$BODY")

if [[ "$HTTP" != "204" ]]; then
  echo "error: HTTP $HTTP" >&2
  cat /tmp/efilicit-dispatch-body.txt >&2 || true
  exit 1
fi
echo "ok: dispatched (HTTP 204)"
