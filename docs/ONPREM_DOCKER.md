# FlowPulse — Deployment On-Premise via Docker

> Guia completo para deploy local/offline com Supabase self-hosted.
> Data: 2026-02-26

---

## 1. Requisitos Mínimos

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disco | 20 GB | 50+ GB (SSD) |
| OS | Debian 12+ / Ubuntu 22.04+ | Debian 13 |
| Docker | 24.0+ | Última estável |
| Docker Compose | Plugin v2.20+ | Última estável |
| Node.js | 20 LTS (apenas para build) | 22 LTS |

### Instalar Docker (Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout e login novamente
```

---

## 2. Quick Start

```bash
# 1. Clonar o repositório
git clone <repo-url> flowpulse && cd flowpulse

# 2. Subir tudo (build + containers + schema + seed)
bash scripts/onprem-up.sh

# 3. Acessar
# UI:    http://localhost
# Login: admin@flowpulse.local / admin@123
```

---

## 3. Configuração

### 3.1 Variáveis de Ambiente

Copie e edite o template:

```bash
cp deploy/.env.onprem.docker.example deploy/.env
nano deploy/.env
```

**Variáveis críticas para produção:**

```bash
# Gerar secrets únicos
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
ZABBIX_ENCRYPTION_KEY=$(openssl rand -hex 32)
FLOWPULSE_WEBHOOK_TOKEN=$(openssl rand -hex 32)
```

**Gerar ANON_KEY e SERVICE_ROLE_KEY:**

As chaves JWT devem ser geradas com o mesmo `JWT_SECRET`. Use o gerador oficial:
- https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

Ou via Node.js:

```javascript
const jwt = require('jsonwebtoken');
const secret = 'SEU_JWT_SECRET';

// Anon key
console.log('ANON_KEY=', jwt.sign({ role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 10*365*24*3600 }, secret));

// Service role key
console.log('SERVICE_ROLE_KEY=', jwt.sign({ role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 10*365*24*3600 }, secret));
```

### 3.2 Trocar Hostname

1. Edite `deploy/.env`:
   ```
   SITE_URL=http://flowpulse.meudominio.local
   API_EXTERNAL_URL=http://flowpulse.meudominio.local
   VITE_SUPABASE_URL=http://flowpulse.meudominio.local
   ```

2. Reconstrua o frontend e reinicie:
   ```bash
   bash scripts/onprem-up.sh
   ```

3. Configure DNS local ou `/etc/hosts`:
   ```
   192.168.1.100  flowpulse.meudominio.local
   ```

---

## 4. Arquitetura Docker

```
┌──────────────────────────────────────────────────────────┐
│                     Rede: flowpulse_net                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Nginx   │→│   Kong   │→│   Auth   │              │
│  │  :80     │  │  :8000   │  │  :9999   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│       │              │                                    │
│       │         ┌────┴──────────────────────┐            │
│       │         │         │        │        │            │
│       │    ┌────┴──┐ ┌───┴───┐ ┌──┴──┐ ┌──┴──────┐    │
│       │    │ REST  │ │Realtime│ │Store│ │Functions │    │
│       │    │ :3000 │ │ :4000 │ │:5000│ │  :9000   │    │
│       │    └───────┘ └───────┘ └─────┘ └──────────┘    │
│       │         │         │        │                     │
│       │    ┌────┴─────────┴────────┴──────┐             │
│       │    │         PostgreSQL            │             │
│       │    │           :5432              │             │
│       │    └──────────────────────────────┘             │
│  ┌────┴───────────┐                                      │
│  │  dist/ (SPA)   │                                      │
│  └────────────────┘                                      │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Operações

### 5.1 Backup do Banco de Dados

```bash
# Backup
docker exec $(docker compose -f deploy/docker-compose.onprem.yml ps -q db) \
  pg_dump -U supabase_admin -d postgres --clean --if-exists \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i $(docker compose -f deploy/docker-compose.onprem.yml ps -q db) \
  psql -U supabase_admin -d postgres < backup_YYYYMMDD_HHMMSS.sql
```

### 5.2 Reset de Senha do Admin

```bash
bash scripts/onprem-reset-admin.sh
# Ou com senha direta:
bash scripts/onprem-reset-admin.sh "NovaSenha123"
```

### 5.3 Verificar Logs

```bash
cd deploy

# Todos os serviços
docker compose -f docker-compose.onprem.yml logs -f

# Serviço específico
docker compose -f docker-compose.onprem.yml logs -f auth
docker compose -f docker-compose.onprem.yml logs -f functions
docker compose -f docker-compose.onprem.yml logs -f rest
```

### 5.4 Reiniciar Serviços

```bash
cd deploy
docker compose -f docker-compose.onprem.yml restart
# Ou serviço específico:
docker compose -f docker-compose.onprem.yml restart functions
```

### 5.5 Parar / Destruir

```bash
cd deploy
# Parar (preserva volumes)
docker compose -f docker-compose.onprem.yml down

# Destruir tudo (CUIDADO: apaga dados)
docker compose -f docker-compose.onprem.yml down -v
```

---

## 6. Rodar Offline (Air-Gapped)

### Preparação (com internet):

```bash
# 1. Baixar todas as imagens
cd deploy
docker compose -f docker-compose.onprem.yml pull

# 2. Exportar imagens para arquivo
docker save \
  supabase/postgres:15.8.1.060 \
  kong:2.8.1 \
  supabase/gotrue:v2.164.0 \
  postgrest/postgrest:v12.2.3 \
  supabase/realtime:v2.33.58 \
  supabase/storage-api:v1.11.13 \
  darthsim/imgproxy:v3.8.0 \
  supabase/postgres-meta:v0.83.2 \
  supabase/edge-runtime:v1.65.3 \
  nginx:1.27-alpine \
  | gzip > flowpulse-images.tar.gz

# 3. Build do frontend
npm ci && npm run build
```

### No servidor offline:

```bash
# 1. Carregar imagens
docker load < flowpulse-images.tar.gz

# 2. Copiar projeto (com dist/ já compilado)
# 3. Configurar .env
# 4. Subir (sem npm build)
cd deploy
docker compose -f docker-compose.onprem.yml --env-file .env up -d
```

---

## 7. Troubleshooting

| Problema | Solução |
|----------|---------|
| Kong retorna 502 | Verificar se `auth`, `rest` subiram: `docker compose logs auth rest` |
| Login falha | Verificar ANON_KEY e JWT_SECRET consistentes |
| RLS bloqueia queries | Confirmar que JWT contém `app_metadata.tenant_id` |
| Edge Functions 404 | Verificar montagem do volume `supabase/functions` |
| Realtime não conecta | Verificar WebSocket upgrade no Nginx (já configurado) |
| Disco cheio | Limpar logs: `docker system prune -f` |

---

## 8. Smoke Test

```bash
bash scripts/smoke-onprem.sh
# Ou com URLs customizadas:
bash scripts/smoke-onprem.sh http://flowpulse.local http://flowpulse.local:8000
```
