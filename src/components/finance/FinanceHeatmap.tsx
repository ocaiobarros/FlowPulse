import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";

interface Props {
  transactions: any[];
  monthReference: string;
}

export default function FinanceHeatmap({ transactions, monthReference }: Props) {
  const { cells, monthLabel, maxAbs } = useMemo(() => {
    const [y, m] = monthReference.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=Sun

    const label = new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Aggregate daily net flow
    const dailyMap = new Map<number, number>();
    for (const t of transactions) {
      const d = new Date(t.transaction_date).getDate();
      const sign = t.type === "RECEBER" ? 1 : -1;
      dailyMap.set(d, (dailyMap.get(d) || 0) + Number(t.amount) * sign);
    }

    const max = Math.max(...[...dailyMap.values()].map(Math.abs), 1);

    const grid: { day: number; value: number; empty?: boolean }[] = [];

    // Empty cells for alignment
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push({ day: 0, value: 0, empty: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ day: d, value: dailyMap.get(d) || 0 });
    }

    return { cells: grid, monthLabel: label.charAt(0).toUpperCase() + label.slice(1), maxAbs: max };
  }, [transactions, monthReference]);

  if (transactions.length === 0) return null;

  const getColor = (value: number) => {
    const intensity = Math.min(Math.abs(value) / maxAbs, 1);
    if (value > 0) {
      // Green shades
      const lightness = 50 - intensity * 25; // 50% to 25%
      const saturation = 40 + intensity * 60; // 40% to 100%
      return `hsl(142, ${saturation}%, ${lightness}%)`;
    }
    if (value < 0) {
      // Red/amber shades
      const lightness = 55 - intensity * 25;
      const saturation = 50 + intensity * 40;
      return `hsl(0, ${saturation}%, ${lightness}%)`;
    }
    return "hsl(215, 15%, 12%)";
  };

  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="rounded-2xl bg-card/40 backdrop-blur-xl border border-border/10 p-6 shadow-xl"
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="p-1.5 rounded-lg bg-neon-cyan/10">
          <CalendarDays className="w-4 h-4 text-neon-cyan" />
        </div>
        <div>
          <h3 className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-[0.15em]">
            Heatmap Financeiro
          </h3>
          <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
            {monthLabel} — Saúde diária do fluxo de caixa
          </p>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {weekdays.map((d, i) => (
          <div key={i} className="text-center text-[8px] font-mono text-muted-foreground/40 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="relative group"
          >
            <div
              className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-mono transition-all duration-200 ${
                cell.empty
                  ? ""
                  : "cursor-default hover:ring-1 hover:ring-foreground/20 hover:scale-110"
              }`}
              style={{
                backgroundColor: cell.empty ? "transparent" : getColor(cell.value),
                opacity: cell.empty ? 0 : cell.value === 0 ? 0.4 : 1,
              }}
            >
              {!cell.empty && (
                <span className="text-foreground/80 font-semibold text-[9px]">
                  {cell.day}
                </span>
              )}
            </div>

            {/* Tooltip on hover */}
            {!cell.empty && cell.value !== 0 && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div className="rounded-lg bg-card/95 backdrop-blur-xl border border-border/50 px-3 py-1.5 text-[9px] font-mono shadow-xl whitespace-nowrap">
                  <span className="text-muted-foreground">Dia {cell.day}: </span>
                  <span className={cell.value >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {cell.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border/10">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0, 80%, 42%)" }} />
          <span className="text-[8px] font-mono text-muted-foreground/60">Déficit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(215, 15%, 12%)" }} />
          <span className="text-[8px] font-mono text-muted-foreground/60">Neutro</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142, 80%, 35%)" }} />
          <span className="text-[8px] font-mono text-muted-foreground/60">Superávit</span>
        </div>
      </div>
    </motion.div>
  );
}
