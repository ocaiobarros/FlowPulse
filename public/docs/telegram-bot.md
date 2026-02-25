# Bot do Telegram

O **Bot do Telegram** do FlowPulse permite receber alertas e consultar o status da rede diretamente no Telegram.

## Configuração

1. Acesse **Configurações → Telegram**
2. Insira o **Bot Token** obtido via [@BotFather](https://t.me/BotFather)
3. Configure o **Chat ID** do grupo ou usuário que receberá os alertas
4. Salve e teste a conexão

## Comandos Disponíveis

### `/ajuda` ou `/start`
Exibe o menu interativo com todos os comandos disponíveis e um link direto para o painel web.

### `/status`
Retorna a saúde geral do sistema:
- Hosts online/offline
- Incidentes abertos
- Uptime global

### `/status [nome]`
Consulta o status em tempo real de uma impressora específica:
- Status (online/offline)
- Contador Zabbix atual
- Contador Base (contrato)
- Total Faturado

Exemplo: `/status Portaria`

### `/flowmaps`
Lista os FlowMaps disponíveis com navegação interativa:
1. Selecione um mapa para ver os links
2. Selecione um link para abrir a escolha de período
3. Escolha o período do gráfico: **1 Hora**, **6 Horas** ou **24 Horas**
4. O Bot envia o status "Enviando foto..." e gera o gráfico automaticamente
5. A legenda inclui: nome do link, período, picos de tráfego IN/OUT e número de métricas

### `/contadores`
Lista todas as impressoras monitoradas com seus contadores de faturamento:
- Nome/Setor da impressora
- Contador de Faturamento (Base + Zabbix)
- Total consolidado de páginas

### `/toner`
Lista impressoras com suprimentos abaixo de 10%:
- Nome da impressora
- Nível de cada suprimento crítico

### `/estoque`
Previsão de esgotamento de suprimentos nos próximos 10 dias:
- Impressoras com troca estimada em breve
- Consumo médio diário (baseado nos últimos 15 dias)
- Data estimada de esgotamento

### `/fechamento`
Consulta o último snapshot mensal salvo no sistema:
- Período e data de captura
- Lista de impressoras com contadores
- Total consolidado de páginas

### Gráficos de Tráfego

Ao selecionar um período, o Bot gera um gráfico de linha via QuickChart contendo:

| Campo | Descrição |
| --- | --- |
| **Eixo X** | Horários do intervalo selecionado |
| **Eixo Y** | Tráfego em Mbps |
| **Linha Azul** | Tráfego de entrada (IN ▼) |
| **Linha Verde** | Tráfego de saída (OUT ▲) |
| **Legenda** | Nome do link, capacidade, status, período e picos |

## Alertas Automáticos

O bot envia notificações automáticas para:
- ⬇️ Queda de sessão BGP
- 🔴 Host crítico DOWN
- ⚠️ CPU acima do limiar configurado
- 🔐 Acessos administrativos
- 📊 Fechamento mensal de contadores de impressão
- 🖨️ Erros de impressora (Papel Preso, Porta Aberta)
- 🔮 Previsão de esgotamento de suprimentos (alerta antecipado 5 dias antes)

## Previsão de Esgotamento (Predictive Supply)

O sistema analisa o consumo histórico de toner/tinta dos últimos 15 dias para calcular:
- **Consumo médio diário** (% por dia)
- **Data estimada de esgotamento** (nível atual ÷ consumo diário)
- **Indicador visual** no card da impressora: Verde (>15d), Amarelo (7-14d), Vermelho pulsante (<7d)

Se a impressora ficar offline por mais de 24h, a projeção é suspensa e exibe "Dados insuficientes".

## Fechamento Mensal

No último dia de cada mês, o sistema automaticamente:
1. Captura um snapshot de todos os contadores de impressão
2. Salva o registro na tabela `billing_logs`
3. Envia um resumo via Telegram com todos os contadores de faturamento

## Segurança

O webhook do Telegram é registrado via Edge Function com bypass de JWT para permitir comunicações seguras vindas dos servidores do Telegram.
