/**
 * SLA Governance PDF Export — Client-side PDF generation using browser print
 * Creates a styled HTML document and triggers print-to-PDF
 */

interface SLAMetrics {
  uptime: number;
  breaches: number;
  totalDownSeconds: number;
  totalAlerts: number;
  worstHosts: { host: string; downSeconds: number; uptime: number }[];
  dailyUptime: { day: string; uptime: number }[];
}

interface SLAPolicy {
  id: string;
  name: string;
  ack_target_seconds: number;
  resolve_target_seconds: number;
}

interface AlertRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
  ack_breached_at: string | null;
  resolve_breached_at: string | null;
  payload: Record<string, any>;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export function exportSLAPdf({
  metrics,
  policies,
  alerts,
  period,
  filters,
}: {
  metrics: SLAMetrics;
  policies: SLAPolicy[];
  alerts: AlertRow[];
  period: string;
  filters: { group?: string; host?: string };
}) {
  const now = new Date().toLocaleString("pt-BR");
  const periodLabel = period === "current" ? "Mês Atual" : "Mês Anterior";
  const filterLabel = filters.host
    ? `Host: ${filters.host}`
    : filters.group
      ? `Grupo: ${filters.group}`
      : "Todos os Ativos";

  const violations = alerts.filter((a) => a.ack_breached_at || a.resolve_breached_at);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Relatório SLA — FlowPulse</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; color: #1a1a2e; padding: 32px; font-size: 11px; }
  h1 { font-size: 18px; color: #0B0E14; margin-bottom: 4px; }
  h2 { font-size: 13px; color: #555; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { font-size: 10px; color: #888; margin-bottom: 20px; }
  .cards { display: flex; gap: 12px; margin-bottom: 16px; }
  .card { flex: 1; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; }
  .card-label { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .card-value { font-size: 20px; font-weight: bold; margin-top: 2px; }
  .green { color: #16a34a; }
  .red { color: #dc2626; }
  .amber { color: #d97706; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
  th { text-align: left; padding: 4px 6px; background: #f5f5f5; border-bottom: 1px solid #ddd; font-size: 9px; text-transform: uppercase; color: #666; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-amber { background: #fef3c7; color: #d97706; }
  .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>📊 Relatório de SLA & Disponibilidade</h1>
<div class="meta">
  Gerado em: ${now} | Período: ${periodLabel} | Filtro: ${filterLabel}
</div>

<div class="cards">
  <div class="card">
    <div class="card-label">Uptime Global</div>
    <div class="card-value ${metrics.uptime >= 99.9 ? "green" : metrics.uptime >= 99 ? "amber" : "red"}">${metrics.uptime.toFixed(3)}%</div>
  </div>
  <div class="card">
    <div class="card-label">Violações SLA</div>
    <div class="card-value ${metrics.breaches === 0 ? "green" : "red"}">${metrics.breaches}</div>
  </div>
  <div class="card">
    <div class="card-label">Downtime Total</div>
    <div class="card-value amber">${formatDuration(metrics.totalDownSeconds)}</div>
  </div>
  <div class="card">
    <div class="card-label">Total de Incidentes</div>
    <div class="card-value">${metrics.totalAlerts}</div>
  </div>
</div>

<h2>🔻 Pior Performance (Top 5)</h2>
${metrics.worstHosts.length === 0 ? "<p style='color:#888;'>Nenhum incidente no período.</p>" : `
<table>
  <thead><tr><th>Host</th><th>Downtime</th><th>Uptime</th></tr></thead>
  <tbody>
    ${metrics.worstHosts.map((h) => `
      <tr>
        <td>${h.host}</td>
        <td>${formatDuration(h.downSeconds)}</td>
        <td><span class="${h.uptime >= 99.9 ? "green" : h.uptime >= 99 ? "amber" : "red"}">${h.uptime.toFixed(3)}%</span></td>
      </tr>
    `).join("")}
  </tbody>
</table>`}

<h2>📅 Uptime Diário (30 dias)</h2>
<table>
  <thead><tr>${metrics.dailyUptime.map((d) => `<th style="text-align:center;font-size:7px;padding:2px;">${d.day}</th>`).join("")}</tr></thead>
  <tbody><tr>${metrics.dailyUptime.map((d) => `<td style="text-align:center;font-size:9px;color:${d.uptime >= 99.9 ? "#16a34a" : d.uptime >= 99 ? "#d97706" : "#dc2626"}">${d.uptime.toFixed(1)}%</td>`).join("")}</tr></tbody>
</table>

${policies.length > 0 ? `
<h2>🛡️ Políticas de SLA</h2>
<table>
  <thead><tr><th>Política</th><th>Tempo de Resposta</th><th>Tempo de Resolução</th></tr></thead>
  <tbody>
    ${policies.map((p) => `
      <tr><td>${p.name}</td><td>${formatDuration(p.ack_target_seconds)}</td><td>${formatDuration(p.resolve_target_seconds)}</td></tr>
    `).join("")}
  </tbody>
</table>` : ""}

<h2>⚠️ Violações de SLA (${violations.length})</h2>
${violations.length === 0 ? "<p style='color:#16a34a;font-weight:600;'>✅ Nenhuma violação de SLA no período!</p>" : `
<table>
  <thead><tr><th>Severidade</th><th>Host</th><th>Alerta</th><th>Status</th><th>Tipo Violação</th></tr></thead>
  <tbody>
    ${violations.slice(0, 50).map((a) => {
      const host = a.payload?.hostname || a.payload?.host || "—";
      const vType = [a.ack_breached_at ? "ACK" : "", a.resolve_breached_at ? "Resolução" : ""].filter(Boolean).join(" + ");
      return `<tr>
        <td><span class="badge badge-${a.severity === "disaster" || a.severity === "high" ? "red" : "amber"}">${a.severity}</span></td>
        <td>${host}</td>
        <td>${a.title}</td>
        <td>${a.status}</td>
        <td><span class="badge badge-red">${vType}</span></td>
      </tr>`;
    }).join("")}
  </tbody>
</table>`}

<div class="footer">FlowPulse — SLA Governance Report — ${now}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
