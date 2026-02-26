#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  FLOWPULSE — Smoke Test On-Premise (Docker)                     ║
# ║  Valida todos os serviços do stack Supabase self-hosted          ║
# ║  Uso: bash scripts/smoke-onprem.sh [base_url]                   ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

BASE="${1:-http://localhost}"
API="${2:-http://localhost:8000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✔${NC} $desc"
    ((PASS++))
  else
    echo -e "  ${RED}✘${NC} $desc"
    ((FAIL++))
  fi
}

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   FlowPulse On-Premise — Smoke Test (Docker)    ║"
echo "║   UI:  ${BASE}"
echo "║   API: ${API}"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. Healthz (Nginx) ──────────────────────────────────
echo -e "${CYAN}[1/6] Health Check${NC}"
HEALTH=$(curl -sS --max-time 5 "${BASE}/healthz" 2>/dev/null || echo '{}')
check "GET /healthz retorna OK" echo "$HEALTH" | grep -q '"ok"'

# ─── 2. Auth Health ──────────────────────────────────────
echo -e "\n${CYAN}[2/6] Auth (GoTrue)${NC}"
AUTH_HEALTH=$(curl -sS --max-time 5 "${API}/auth/v1/health" 2>/dev/null || echo '{}')
check "GoTrue health" echo "$AUTH_HEALTH" | grep -qi 'alive\|ok'

# ─── 3. Login Admin ──────────────────────────────────────
echo -e "\n${CYAN}[3/6] Login Admin${NC}"
LOGIN_RESP=$(curl -sS --max-time 10 -X POST "${API}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowpulse.local","password":"admin@123"}' 2>/dev/null || echo '{}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "  ${GREEN}✔${NC} Login admin bem-sucedido"
  ((PASS++))
else
  echo -e "  ${RED}✘${NC} Login admin falhou"
  echo "    Resposta: $(echo "$LOGIN_RESP" | head -c 200)"
  ((FAIL++))
fi

# ─── 4. REST API ─────────────────────────────────────────
echo -e "\n${CYAN}[4/6] REST API (PostgREST)${NC}"
if [ -n "$TOKEN" ]; then
  TENANTS_RESP=$(curl -sS --max-time 5 \
    -H "Authorization: Bearer $TOKEN" \
    -H "apikey: ${ANON_KEY:-}" \
    "${API}/rest/v1/tenants?limit=1" 2>/dev/null || echo '[]')
  check "GET /rest/v1/tenants responde" test $? -eq 0
  
  # Test RPC
  RPC_RESP=$(curl -sS --max-time 5 -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "apikey: ${ANON_KEY:-}" \
    -H "Content-Type: application/json" \
    "${API}/rest/v1/rpc/get_user_tenant_id" \
    -d "{\"p_user_id\": \"00000000-0000-0000-0000-000000000000\"}" 2>/dev/null || echo '{}')
  check "RPC get_user_tenant_id responde" test $? -eq 0
else
  echo -e "  ${RED}✘${NC} Pulando — sem token"
  ((FAIL += 2))
fi

# ─── 5. Edge Function ────────────────────────────────────
echo -e "\n${CYAN}[5/6] Edge Functions${NC}"
FUNC_RESP=$(curl -sS --max-time 10 -X POST \
  -H "apikey: ${ANON_KEY:-}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY:-}" \
  "${API}/functions/v1/system-status" 2>/dev/null || echo '{}')
check "POST /functions/v1/system-status responde" test $? -eq 0

# ─── 6. UI ───────────────────────────────────────────────
echo -e "\n${CYAN}[6/6] Frontend (Nginx)${NC}"
UI_RESP=$(curl -sS --max-time 5 -o /dev/null -w "%{http_code}" "${BASE}/" 2>/dev/null || echo "000")
if [ "$UI_RESP" = "200" ]; then
  echo -e "  ${GREEN}✔${NC} UI acessível (HTTP 200)"
  ((PASS++))
else
  echo -e "  ${RED}✘${NC} UI retornou HTTP $UI_RESP"
  ((FAIL++))
fi

# ─── Resultado ────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}═══ RESULTADO: ${PASS}/${TOTAL} testes passaram ═══${NC}"
  exit 0
else
  echo -e "${RED}═══ RESULTADO: ${PASS}/${TOTAL} passaram, ${FAIL} falharam ═══${NC}"
  exit 1
fi
