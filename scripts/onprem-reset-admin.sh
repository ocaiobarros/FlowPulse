#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  FlowPulse — Reset de Senha Admin (Docker On-Prem)              ║
# ║  Uso: bash scripts/onprem-reset-admin.sh [nova_senha]           ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/../deploy" && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.onprem.yml"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@flowpulse.local}"

echo "╔══════════════════════════════════════════╗"
echo "║   FlowPulse — Reset de Senha do Admin   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Conta alvo: $ADMIN_EMAIL"
echo ""

if [ -n "${1:-}" ]; then
  NEW_PASSWORD="$1"
else
  read -sp "Digite a nova senha para o admin: " NEW_PASSWORD
  echo ""
  if [ ${#NEW_PASSWORD} -lt 6 ]; then
    echo "❌ Erro: A senha deve ter pelo menos 6 caracteres."
    exit 1
  fi
  read -sp "Confirme a nova senha: " CONFIRM_PASSWORD
  echo ""
  if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo "❌ Erro: As senhas não coincidem."
    exit 1
  fi
fi

echo ""
echo "⏳ Atualizando senha no banco de dados..."

DB_CONTAINER=$(cd "$DEPLOY_DIR" && docker compose -f docker-compose.onprem.yml ps -q db)

docker exec -i "$DB_CONTAINER" psql -U supabase_admin -d postgres -c "
UPDATE auth.users
SET encrypted_password = crypt('$NEW_PASSWORD', gen_salt('bf'))
WHERE email = '$ADMIN_EMAIL';
"

if [ $? -eq 0 ]; then
  echo "✅ Senha do Admin ($ADMIN_EMAIL) atualizada com sucesso!"
else
  echo "❌ Falha ao atualizar a senha."
  exit 1
fi
