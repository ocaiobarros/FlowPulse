import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";

const fmtBRL = (v: number) =>
  "R$ " + Math.round(v).toLocaleString("pt-BR");

const tickFmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
};

function PressureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isCritical = payload.some((p: any) => p.payload?.critical);
  return (
    <div className={`rounded-lg border px-3 py-2 shadow-xl backdrop-blur-sm ${isCritical ? "bg-destructive/10 border-destructive/30" : "bg-card border-border"}`}>
      <p className="text-xs text-muted-foreground mb-1">
        Dia {label} {isCritical && <span className="text-destructive font-semibold">⚠ CRÍTICO</span>}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-xs text-muted-foreground">{p.name}</span>
          <span style={{ color: p.color || p.stroke }} className="font-semibold text-xs">
            {typeof p.value === "number" ? fmtBRL(p.value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  transactions: any[];
  monthReference: string;
}

export default function PressureAnalysisChart({ transactions, monthReference }: Props) {
  const { data, hasBoth, criticalDays, criticalCount } = useMemo(() => {
    const [y, m] = monthReference.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const hasPrev = transactions.some((t: any) => t.scenario === "PREVISTO");
    const hasReal = transactions.some((t: any) => t.scenario === "REALIZADO");

    if (!hasPrev || !hasReal) return { data: [], hasBoth: false, criticalDays: [], criticalCount: 0 };

    const dailyMap = new Map<number, { prevPagar: number; prevReceber: number; realPagar: number; realReceber: number }>();
    for (const t of transactions) {
      const d = new Date(t.transaction_date).getDate();
      if (!dailyMap.has(d)) dailyMap.set(d, { prevPagar: 0, prevReceber: 0, realPagar: 0, realReceber: 0 });
      const entry = dailyMap.get(d)!;
      const amount = Number(t.amount) || 0;
      if (t.scenario === "PREVISTO") {
        if (t.type === "PAGAR") entry.prevPagar += amount;
        else entry.prevReceber += amount;
      } else {
        if (t.type === "PAGAR") entry.realPagar += amount;
        else entry.realReceber += amount;
      }
    }

    const result: any[] = [];
    const crits: number[] = [];
    let cumOp = 0, cumFin = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const entry = dailyMap.get(d) || { prevPagar: 0, prevReceber: 0, realPagar: 0, realReceber: 0 };
      const pressaoOp = Math.round((entry.realPagar - entry.prevPagar) * 100) / 100;
      const pressaoFin = Math.round((entry.realReceber - entry.prevReceber) * 100) / 100;

      cumOp += pressaoOp;
      cumFin += pressaoFin;

      // Critical: financial pressure > operational by 20%+
      const absFin = Math.abs(pressaoFin);
      const absOp = Math.abs(pressaoOp);
      const critical = absOp > 0 && absFin > absOp * 1.2;
      if (critical) crits.push(d);

      result.push({
        day: String(d),
        pressaoOp,
        pressaoFin,
        cumOp: Math.round(cumOp * 100) / 100,
        cumFin: Math.round(cumFin * 100) / 100,
        critical,
      });
    }

    return { data: result, hasBoth: true, criticalDays: crits, criticalCount: crits.length };
  }, [transactions, monthReference]);

  if (!hasBoth || data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Alert Banner */}
      {criticalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {criticalCount} dia{criticalCount > 1 ? "s" : ""} crítico{criticalCount > 1 ? "s" : ""} detectado{criticalCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pressão Financeira ultrapassou a Operacional em mais de 20% nos dias: {criticalDays.join(", ")}
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Pressure Bar Chart ── */}
        <div className="rounded-2xl bg-card/40 border border-border/20 p-5">
          <h3 className="text-sm font-bold text-foreground mb-1">Pressão Diária</h3>
          <p className="text-xs text-muted-foreground mb-4">Realizado − Previsto por dia (barras vermelhas = dias críticos)</p>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tickFormatter={tickFmt} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={50} axisLine={false} tickLine={false} />
              <Tooltip content={<PressureTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />

              <Bar dataKey="pressaoOp" name="Operacional" radius={[2, 2, 0, 0]} barSize={6}>
                {data.map((entry: any, i: number) => (
                  <Cell
                    key={i}
                    fill={entry.critical ? "hsl(var(--destructive))" : "hsl(var(--neon-blue))"}
                    fillOpacity={entry.critical ? 0.9 : 0.7}
                  />
                ))}
              </Bar>
              <Bar dataKey="pressaoFin" name="Financeira" radius={[2, 2, 0, 0]} barSize={6}>
                {data.map((entry: any, i: number) => (
                  <Cell
                    key={i}
                    fill={entry.critical ? "hsl(0, 70%, 45%)" : "hsl(142, 70%, 45%)"}
                    fillOpacity={entry.critical ? 0.9 : 0.7}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Cumulative Pressure Line Chart ── */}
        <div className="rounded-2xl bg-card/40 border border-border/20 p-5">
          <h3 className="text-sm font-bold text-foreground mb-1">Pressão Acumulada</h3>
          <p className="text-xs text-muted-foreground mb-4">Soma cumulativa dia a dia</p>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="cumOpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--neon-blue))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--neon-blue))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cumFinFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tickFormatter={tickFmt} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={50} axisLine={false} tickLine={false} />
              <Tooltip content={<PressureTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />

              <Line
                type="monotone"
                dataKey="cumOp"
                name="Acum. Operacional"
                stroke="hsl(var(--neon-blue))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1.5 }}
              />
              <Line
                type="monotone"
                dataKey="cumFin"
                name="Acum. Financeira"
                stroke="hsl(142, 70%, 45%)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1.5 }}
              />

              {/* Mark critical days with dots */}
              {data.filter((d: any) => d.critical).map((d: any) => (
                <ReferenceLine
                  key={d.day}
                  x={d.day}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
