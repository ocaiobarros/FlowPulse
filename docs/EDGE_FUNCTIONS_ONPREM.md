# FlowPulse — Edge Functions On-Premise

> Guia de operação das Edge Functions no stack Docker self-hosted.
> Data: 2026-02-26

---

## Visão Geral

As Edge Functions rodam no container `functions` (supabase/edge-runtime) com o diretório
`supabase/functions/` montado como volume read-only. Cada subdiretório com `index.ts` é
automaticamente exposto como `/functions/v1/<nome>`.

---

## Inventário Completo

| # | Função | Env Vars Necessárias | Endpoint de Teste |
|---|--------|---------------------|-------------------|
| 1 | `alert-ingest` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWPULSE_WEBHOOK_TOKEN | `curl -X POST http://localhost:8000/functions/v1/alert-ingest -H "X-Webhook-Token: $TOKEN"` |
| 2 | `alert-escalation-worker` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN*, TELEGRAM_CHAT_ID* | `curl -X POST http://localhost:8000/functions/v1/alert-escalation-worker -H "Authorization: Bearer $SRK"` |
| 3 | `bgp-collector` | SUPABASE_URL, SUPABASE_ANON_KEY | `curl http://localhost:8000/functions/v1/bgp-collector -H "apikey: $ANON"` |
| 4 | `billing-cron` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/billing-cron -H "Authorization: Bearer $SRK"` |
| 5 | `cto-status-aggregator` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/cto-status-aggregator -H "Authorization: Bearer $TOKEN"` |
| 6 | `flowmap-route` | — | `curl -X POST http://localhost:8000/functions/v1/flowmap-route -H "Content-Type: application/json" -d '{"from":[-20.46,-54.62],"to":[-20.47,-54.63]}'` |
| 7 | `flowmap-status` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/flowmap-status -H "Authorization: Bearer $TOKEN"` |
| 8 | `flowpulse-reactor` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS_REST_URL*, UPSTASH_REDIS_REST_TOKEN* | `curl -X POST http://localhost:8000/functions/v1/flowpulse-reactor -H "Authorization: Bearer $TOKEN"` |
| 9 | `invite-user` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/invite-user -H "Authorization: Bearer $TOKEN"` |
| 10 | `printer-status` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/printer-status -H "Authorization: Bearer $TOKEN"` |
| 11 | `rms-connections` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/rms-connections -H "Authorization: Bearer $TOKEN"` |
| 12 | `rms-fueling` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RMS_FUELING_API_TOKEN* | `curl -X POST http://localhost:8000/functions/v1/rms-fueling -H "Authorization: Bearer $TOKEN"` |
| 13 | `seed-admin` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/seed-admin` |
| 14 | `system-status` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/system-status -H "Authorization: Bearer $SRK"` |
| 15 | `telegram-bot` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN*, TELEGRAM_CHAT_ID* | `curl -X POST http://localhost:8000/functions/v1/telegram-bot -H "Authorization: Bearer $TOKEN"` |
| 16 | `telemetry-wizard` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/telemetry-wizard -H "Authorization: Bearer $TOKEN"` |
| 17 | `webhook-token-manage` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/webhook-token-manage -H "Authorization: Bearer $TOKEN"` |
| 18 | `zabbix-connections` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/zabbix-connections -H "Authorization: Bearer $TOKEN"` |
| 19 | `zabbix-poller` | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/zabbix-poller -H "Authorization: Bearer $TOKEN"` |
| 20 | `zabbix-proxy` | SUPABASE_URL, SUPABASE_ANON_KEY, ZABBIX_ENCRYPTION_KEY | `curl -X POST http://localhost:8000/functions/v1/zabbix-proxy -H "Authorization: Bearer $TOKEN"` |
| 21 | `zabbix-webhook` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | `curl -X POST http://localhost:8000/functions/v1/zabbix-webhook -H "X-Webhook-Token: $TOKEN"` |

> \* = Opcional. A função opera sem essas vars mas com funcionalidade reduzida.

---

## Legenda de Variáveis

| Variável no curl | Significado |
|-------------------|-------------|
| `$TOKEN` | JWT do usuário logado (obtido via login) |
| `$SRK` | SERVICE_ROLE_KEY (acesso admin) |
| `$ANON` | ANON_KEY |

---

## Configuração no Docker

Todas as env vars são passadas via `deploy/.env` → `docker-compose.onprem.yml` → container `functions`.

Para adicionar uma nova variável:

1. Adicione em `deploy/.env`
2. Adicione no bloco `environment` do serviço `functions` em `docker-compose.onprem.yml`
3. Reinicie: `docker compose -f deploy/docker-compose.onprem.yml restart functions`

---

## Troubleshooting

```bash
# Ver logs das functions
docker compose -f deploy/docker-compose.onprem.yml logs -f functions

# Testar se o runtime responde
curl http://localhost:8000/functions/v1/system-status \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $ANON_KEY"

# Verificar se as functions estão montadas
docker exec $(docker compose -f deploy/docker-compose.onprem.yml ps -q functions) \
  ls /home/deno/functions/
```
