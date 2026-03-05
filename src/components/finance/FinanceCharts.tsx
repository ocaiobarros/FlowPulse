import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3 } from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const tickFmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-card/95 backdrop-blur-xl border border-border/50 p-4 text-xs shadow-2xl">
      <p className="font-mono text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="font-semibold text-sm">
          {p.name}: {typeof p.value === "number" ? fmt(p.value) : "—"}
        </p>
      ))}
    </div>
  );
}

interface Props {
  monthReference: string;
}

export default function FinanceCharts({ monthReference }: Props) {
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["finance-performance", monthReference],
    queryFn: async () => {
      const start = monthReference;
      const [y, m] = monthReference.split("-").map(Number);
      const endDate = new Date(y, m, 0);
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("vw_financial_daily_performance" as any)
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const chartData = (() => {
    const map = new Map<string, any>();
    for (const row of raw) {
      const dateStr = new Date(row.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr });
      }
      const entry = map.get(dateStr)!;
      if (row.scenario === "PREVISTO") {
        entry.previsto = Number(row.running_balance);
        entry.netPrevisto = Number(row.daily_net_flow);
      } else {
        entry.realizado = Number(row.running_balance);
        entry.netRealizado = Number(row.daily_net_flow);
        entry.variance = Number(row.variance);
      }
    }

    // Add tolerance band (±10%) around Previsto
    const entries = Array.from(map.values());
    for (const entry of entries) {
      if (entry.previsto !== undefined) {
        const margin = Math.abs(entry.previsto) * 0.1;
        entry.toleranceHigh = entry.previsto + margin;
        entry.toleranceLow = entry.previsto - margin;
      }
    }

    return entries;
  })();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl bg-card/40 border border-border/10 p-6 h-[380px] animate-pulse">
            <div className="h-3 w-32 bg-muted rounded mb-6" />
            <div className="h-full bg-muted/20 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl bg-card/40 border border-border/10 p-12 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
        <p className="text-xs text-muted-foreground">Importe dados para visualizar os gráficos</p>
      </div>
    );
  }

  const hasRealizado = chartData.some(d => d.realizado !== undefined);

  // Filter waterfall to only significant deviations (> 5% of max absolute value)
  const waterfallKey = hasRealizado ? "netRealizado" : "netPrevisto";
  const maxAbsFlow = Math.max(...chartData.map(d => Math.abs(d[waterfallKey] ?? 0)), 1);
  const significanceThreshold = maxAbsFlow * 0.03;
  const waterfallData = chartData.filter(d => {
    const val = d[waterfallKey] ?? 0;
    return Math.abs(val) >= significanceThreshold;
  });

  // Check if realizado is outside tolerance band
  const hasBreachPoints = chartData.some(d =>
    d.realizado !== undefined && d.toleranceHigh !== undefined &&
    (d.realizado > d.toleranceHigh || d.realizado < d.toleranceLow)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* S-Curve with Confidence Band */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="rounded-2xl bg-card/40 backdrop-blur-xl border border-border/10 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-[0.15em]">
                S-Curve — Saldo Acumulado
              </h3>
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                Corredor de confiança ±10%
              </p>
            </div>
          </div>
          {hasBreachPoints && (
            <span className="text-[9px] font-mono px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              ⚠ FORA DO CORREDOR
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRealizado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 100%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(142, 100%, 50%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradTolerance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(215, 15%, 35%)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={tickFmt}
              tick={{ fontSize: 9, fill: "hsl(215, 15%, 35%)" }}
              width={55}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
              formatter={(v: string) => <span className="text-muted-foreground/70 text-[10px]">{v}</span>}
            />

            {/* Tolerance band - upper */}
            <Area
              type="monotone"
              dataKey="toleranceHigh"
              name="Teto (+10%)"
              stroke="none"
              fill="url(#gradTolerance)"
              dot={false}
              activeDot={false}
              legendType="none"
            />
            {/* Tolerance band - lower */}
            <Area
              type="monotone"
              dataKey="toleranceLow"
              name="Piso (-10%)"
              stroke="hsl(210, 100%, 56%)"
              strokeWidth={0.5}
              strokeDasharray="2 4"
              strokeOpacity={0.3}
              fill="hsl(var(--background))"
              dot={false}
              activeDot={false}
              legendType="none"
            />

            {/* Previsto line */}
            <Area
              type="monotone"
              dataKey="previsto"
              name="Previsto"
              stroke="hsl(210, 100%, 56%)"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#gradPrevisto)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(210, 100%, 56%)" }}
            />

            {/* Realizado line */}
            {hasRealizado && (
              <Area
                type="monotone"
                dataKey="realizado"
                name="Realizado"
                stroke="hsl(142, 100%, 50%)"
                strokeWidth={2.5}
                fill="url(#gradRealizado)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(142, 100%, 50%)" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Inline micro-insight */}
        {!hasRealizado && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-[9px] font-mono text-amber-300/80">
              Projeção baseada no Previsto — Linha tracejada indica estimativa
            </p>
          </div>
        )}
      </motion.div>

      {/* Waterfall: Significant Deviations Only */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="rounded-2xl bg-card/40 backdrop-blur-xl border border-border/10 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-[0.15em]">
                Waterfall — {hasRealizado ? "Desvios Realizados" : "Fluxo Previsto"}
              </h3>
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                Apenas movimentações significativas
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {waterfallData.length}/{chartData.length} dias
          </span>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="barGain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 80%, 45%)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(142, 80%, 35%)" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 75%, 50%)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(0, 75%, 40%)" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(215, 15%, 35%)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tickFormatter={tickFmt}
              tick={{ fontSize: 9, fill: "hsl(215, 15%, 35%)" }}
              width={55}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(215, 15%, 20%)" strokeWidth={1} />
            <Bar
              dataKey={waterfallKey}
              name="Fluxo Líquido"
              radius={[4, 4, 0, 0]}
            >
              {waterfallData.map((entry, index) => {
                const val = entry[waterfallKey] ?? 0;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={val >= 0 ? "url(#barGain)" : "url(#barLoss)"}
                  />
                );
              })}
            </Bar>
            {hasRealizado && (
              <Bar
                dataKey="variance"
                name="Variância"
                radius={[4, 4, 0, 0]}
                fill="hsl(43, 100%, 50%)"
                opacity={0.3}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
