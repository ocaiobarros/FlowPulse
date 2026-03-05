import { useMemo } from "react";

interface InsightProps {
  transactions: any[];
  monthLabel: string;
}

function fmtShort(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function FinanceInsight({ transactions, monthLabel }: InsightProps) {
  const insights = useMemo(() => {
    const result: { text: string; type: "info" | "positive" | "warning" }[] = [];

    if (transactions.length === 0) return result;

    const calc = (scenario: string, type: string) =>
      transactions
        .filter((t: any) => t.scenario === scenario && t.type === type)
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const prevPagar = calc("PREVISTO", "PAGAR");
    const prevReceber = calc("PREVISTO", "RECEBER");
    const realPagar = calc("REALIZADO", "PAGAR");
    const realReceber = calc("REALIZADO", "RECEBER");

    const pressaoOp = prevPagar - prevReceber;
    const pressaoFin = realPagar - realReceber;
    const hasReal = realPagar > 0 || realReceber > 0;
    const hasPrev = prevPagar > 0 || prevReceber > 0;

    if (hasPrev) {
      result.push({
        text: `Pressão Operacional (Previsto): ${fmtShort(pressaoOp)} — ${pressaoOp > 0 ? "saída líquida planejada" : "entrada líquida planejada"}.`,
        type: pressaoOp > 0 ? "warning" : "positive",
      });
    }

    if (hasReal) {
      result.push({
        text: `Pressão Financeira (Realizado): ${fmtShort(pressaoFin)} — ${pressaoFin > 0 ? "saída líquida efetiva" : "entrada líquida efetiva"}.`,
        type: pressaoFin > 0 ? "warning" : "positive",
      });
    }

    if (hasPrev && hasReal) {
      const desvio = pressaoFin - pressaoOp;
      result.push({
        text: `Desvio: ${fmtShort(desvio)} — ${desvio > 0 ? "pressão real maior que a planejada" : "pressão real menor que a planejada"}.`,
        type: desvio > 0 ? "warning" : "positive",
      });
    }

    if (!hasPrev && !hasReal) {
      result.push({
        text: `${monthLabel} — sem dados importados.`,
        type: "info",
      });
    }

    return result;
  }, [transactions, monthLabel]);

  if (insights.length === 0) return null;

  const dotColor = {
    info: "bg-neon-blue/50",
    positive: "bg-emerald-500/50",
    warning: "bg-amber-500/50",
  };

  return (
    <div className="space-y-1.5">
      {insights.map((insight, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-1">
          <div className={`w-1 h-1 rounded-full shrink-0 ${dotColor[insight.type]}`} />
          <p className="text-[11px] font-mono text-muted-foreground/70 leading-relaxed">
            {insight.text}
          </p>
        </div>
      ))}
    </div>
  );
}
