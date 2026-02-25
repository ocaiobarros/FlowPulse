# FlowPulse Intelligence — Guia Universal de Instalação On-Premise

**© 2026 CBLabs — Versão 2.1**

Este guia cobre a instalação completa do FlowPulse em servidores Debian 13 (Trixie) para operação 100% local, sem dependência de nuvem.

---

## Requisitos do Sistema

| Componente    | Mínimo Recomendado         |
|---------------|---------------------------|
| **OS**        | Debian 13 (Trixie) / Ubuntu 22.04+ |
| **CPU**       | 2 vCPUs                   |
| **RAM**       | 4 GB                      |
| **Disco**     | 20 GB livres              |
| **Node.js**   | v20 LTS                   |
| **PostgreSQL**| 15+                       |
| **Nginx**     | 1.22+                     |

---

## Passo 1 — Preparar o Servidor Debian

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências base
sudo apt install -y curl git build-essential
```

### Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
node -v  # Deve exibir v20.x.x
```

### Instalar PostgreSQL

```bash
sudo apt install -y postgresql
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## Passo 2 — Clonar o Repositório

```bash
cd /root
git clone https://github.com/ocaiobarros/FlowPulse.git
cd FlowPulse
```

---

## Passo 3 — Compilar o Frontend

**IMPORTANTE:** Antes do build, exporte as variáveis apontando para o IP do servidor local.

```bash
# Substitua pelo IP real do servidor na rede
export VITE_SUPABASE_URL="http://SEU_IP_AQUI:3060"
export VITE_SUPABASE_PUBLISHABLE_KEY="flowpulse-onpremise-anon-key"

# Instalar dependências e compilar
npm install --legacy-peer-deps
npm run build
```

Isso gera a pasta `dist/` com o frontend pronto.

---

## Passo 4 — Executar o Instalador Automático

```bash
# Copiar o build para dentro do deploy
cp -r dist/ deploy/dist/

# Executar o instalador
cd deploy
chmod +x install.sh
sudo bash install.sh
```

### O instalador irá:

1. ✅ Verificar e instalar dependências (Node.js, PostgreSQL, Nginx)
2. ✅ Solicitar credenciais do banco interativamente
3. ✅ Criar o banco de dados e o usuário PostgreSQL
4. ✅ Aplicar o schema completo com seed do admin
5. ✅ Gerar JWT_SECRET e arquivo `.env` automaticamente
6. ✅ Instalar dependências do servidor Express
7. ✅ Configurar serviço systemd (`flowpulse`)
8. ✅ Configurar Nginx como reverse proxy

### Dados solicitados pelo instalador:

| Pergunta | Padrão | Descrição |
|----------|--------|-----------|
| Host do PostgreSQL | `127.0.0.1` | Deixe padrão para banco local |
| Porta do PostgreSQL | `5432` | Padrão do PostgreSQL |
| Nome do banco | `flowpulse` | Nome do database |
| Usuário do banco | `flowpulse` | Usuário PostgreSQL |
| Senha do banco | `flowpulse` | Senha do usuário |
| IP do servidor | auto-detectado | IP que o frontend usará para acessar a API |

---

## Passo 5 — Iniciar o Nginx (se necessário)

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## Passo 6 — Verificar a Instalação

```bash
# Verificar se o serviço está rodando
sudo systemctl status flowpulse

# Ver logs em tempo real
sudo journalctl -u flowpulse -f

# Testar a API
curl http://localhost:3060/rest/v1/

# Testar a autenticação
curl -X POST http://localhost:3060/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowpulse.local","password":"admin@123"}'
```

---

## Passo 7 — Acessar o Sistema

Abra o navegador e acesse:

```
http://SEU_IP_AQUI
```

### Credenciais padrão:

| Campo | Valor |
|-------|-------|
| **Usuário** | `admin` |
| **Senha** | `admin@123` |

> ⚠️ **IMPORTANTE:** Troque a senha no primeiro acesso!

---

## Passo 8 — Configurar Chave de Criptografia Zabbix (Opcional)

Se for utilizar integrações com Zabbix, configure a chave de criptografia:

```bash
# Gerar chave segura
ZABBIX_KEY=$(openssl rand -hex 32)

# Adicionar ao .env do servidor
echo "ZABBIX_ENCRYPTION_KEY=$ZABBIX_KEY" >> /opt/flowpulse/.env

# Reiniciar o serviço
sudo systemctl restart flowpulse
```

---

## Estrutura Final no Servidor

```
/opt/flowpulse/
├── server.js              ← API Express (substitui Supabase)
├── dist/                  ← Frontend compilado (servido pelo Nginx)
├── .env                   ← Configurações (JWT, DB, etc.)
├── node_modules/          ← Dependências do servidor
└── schema_cblabs_full.sql ← Schema de referência

/var/lib/flowpulse/data/   ← Storage local (avatares, logos, uploads)
```

---

## Gestão do Serviço

```bash
# Status do serviço
sudo systemctl status flowpulse

# Reiniciar
sudo systemctl restart flowpulse

# Parar
sudo systemctl stop flowpulse

# Logs em tempo real
sudo journalctl -u flowpulse -f

# Logs das últimas 100 linhas
sudo journalctl -u flowpulse -n 100 --no-pager
```

---

## Atualização do Sistema

Para atualizar o FlowPulse em um servidor já instalado:

```bash
# 1. No servidor, acessar o repositório
cd /root/FlowPulse
git pull origin main

# 2. Recompilar o frontend
export VITE_SUPABASE_URL="http://SEU_IP_AQUI:3060"
export VITE_SUPABASE_PUBLISHABLE_KEY="flowpulse-onpremise-anon-key"
npm install --legacy-peer-deps
npm run build

# 3. Copiar o novo build
sudo cp -r dist/* /opt/flowpulse/dist/

# 4. Atualizar o server.js (se houver mudanças no backend)
sudo cp deploy/server.js /opt/flowpulse/server.js

# 5. Reiniciar o serviço
sudo systemctl restart flowpulse
```

### Atualizar o Schema (se houver novas tabelas):

```bash
# Aplicar novo schema (idempotente — usa IF NOT EXISTS)
PGPASSWORD="flowpulse" psql -h 127.0.0.1 -U flowpulse -d flowpulse \
  -f /root/FlowPulse/deploy/schema_cblabs_full.sql
```

---

## Configuração HTTPS (Recomendado para Produção)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado (substitua pelo seu domínio)
sudo certbot --nginx -d flowpulse.seudominio.com.br

# Renovação automática
sudo certbot renew --dry-run
```

---

## Firewall (Recomendado)

```bash
# Instalar UFW
sudo apt install -y ufw

# Regras básicas
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3060/tcp   # API FlowPulse (opcional, se não usar Nginx)

sudo ufw enable
```

---

## Backup do Banco de Dados

```bash
# Backup completo
pg_dump -h 127.0.0.1 -U flowpulse -d flowpulse -F c -f /backup/flowpulse_$(date +%Y%m%d).dump

# Restaurar backup
pg_restore -h 127.0.0.1 -U flowpulse -d flowpulse -c /backup/flowpulse_20260225.dump
```

### Cron para backup diário:

```bash
# Editar crontab
sudo crontab -e

# Adicionar linha (backup às 3h da manhã)
0 3 * * * PGPASSWORD="flowpulse" pg_dump -h 127.0.0.1 -U flowpulse -d flowpulse -F c -f /backup/flowpulse_$(date +\%Y\%m\%d).dump
```

---

## Troubleshooting

### O frontend carrega mas não exibe módulos?

- Verifique se o serviço está rodando: `systemctl status flowpulse`
- Teste o endpoint de auth: `curl http://localhost:3060/auth/v1/token?grant_type=password -H "Content-Type: application/json" -d '{"email":"admin@flowpulse.local","password":"admin@123"}'`
- Verifique se o `.env` tem o `JWT_SECRET` correto

### Erro "502 Bad Gateway" no Nginx?

```bash
# Verificar se o Node.js está escutando na porta 3060
ss -tlnp | grep 3060

# Se não estiver, reiniciar o serviço
sudo systemctl restart flowpulse
```

### Banco de dados não conecta?

```bash
# Verificar se o PostgreSQL está rodando
sudo systemctl status postgresql

# Testar conexão manual
PGPASSWORD="flowpulse" psql -h 127.0.0.1 -U flowpulse -d flowpulse -c "SELECT 1;"
```

### Login com "admin" não funciona?

O sistema aceita login simplificado (só `admin` ao invés de `admin@flowpulse.local`). Se não funcionar:

```bash
# Resetar o admin via SQL
PGPASSWORD="flowpulse" psql -h 127.0.0.1 -U flowpulse -d flowpulse -c "
  UPDATE profiles SET email = 'admin@flowpulse.local' WHERE email LIKE 'admin%';
"
```

---

## Suporte

- **Telegram**: [@flowpulselabsbot](https://t.me/flowpulselabsbot)
- **WhatsApp**: [+55 67 99290-3040](https://wa.me/5567992903040)
- **E-mail**: flowpulselabs@gmail.com

---

*FLOWPULSE INTELLIGENCE | Desenvolvido por CBLabs*
