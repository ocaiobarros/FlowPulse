import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Gauge, Target, Minus } from "lucide-react";

interface KPIData {
  saldoAcumulado: number;
  varianciaPercent: number;
  runwayCaixa: number;
  assertividade: number;
  hasRealizado: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ExecutiveKPICards({ data }: { data: KPIData }) {
  const cards = [
    {
      label: "Saldo Acumulado",
      value: fmt(data.saldoAcumulado),
      icon: TrendingUp,
      trendIcon: data.saldoAcumulado >= 0 ? TrendingUp : TrendingDown,
      accent: data.saldoAcumulado >= 0 ? "emerald" as const : "red" as const,
      subtitle: data.saldoAcumulado >= 0 ? "Caixa positivo" : "Caixa negativo",
      badge: data.hasRealizado ? "REALIZADO" : "PREVISTO",
    },
    {
      label: "Variância",
      value: data.hasRealizado ? `${data.varianciaPercent >= 0 ? "+" : ""}${data.varianciaPercent.toFixed(1)}%` : "—",
      icon: Activity,
      trendIcon: !data.hasRealizado ? Minus : data.varianciaPercent >= 0 ? TrendingUp : TrendingDown,
      accent: !data.hasRealizado ? "neutral" as const : data.varianciaPercent >= 0 ? "emerald" as const : "amber" as const,
      subtitle: !data.hasRealizado ? "Aguardando realizado" : data.varianciaPercent >= 0 ? "Acima do previsto" : "Abaixo do previsto",
      badge: null,
    },
    {
      label: "Runway de Caixa",
      value: data.hasRealizado ? `${data.runwayCaixa.toFixed(1)}` : "—",
      valueSuffix: data.hasRealizado ? " meses" : "",
      icon: Gauge,
      trendIcon: !data.hasRealizado ? Minus : data.runwayCaixa >= 3 ? TrendingUp : TrendingDown,
      accent: !data.hasRealizado ? "neutral" as const : data.runwayCaixa >= 3 ? "emerald" as const : data.runwayCaixa >= 1 ? "amber" as const : "red" as const,
      subtitle: !data.hasRealizado ? "Projeção indisponível" : data.runwayCaixa >= 6 ? "Saudável" : data.runwayCaixa >= 3 ? "Atenção moderada" : "Crítico",
      badge: null,
    },
    {
      label: "Assertividade",
      value: data.hasRealizado ? `${data.assertividade.toFixed(0)}%` : "—",
      icon: Target,
      trendIcon: !data.hasRealizado ? Minus : data.assertividade >= 85 ? TrendingUp : TrendingDown,
      accent: !data.hasRealizado ? "neutral" as const : data.assertividade >= 85 ? "emerald" as const : "amber" as const,
      subtitle: !data.hasRealizado ? "Sem dados realizados" : data.assertividade >= 90 ? "Excelente precisão" : data.assertividade >= 75 ? "Dentro do aceitável" : "Revisar previsões",
      badge: null,
    },
  ];

  const accentStyles = {
    emerald: {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      border: "border-emerald-500/20 hover:border-emerald-500/35",
      text: "text-emerald-400",
      glow: "shadow-[0_0_30px_-8px_hsl(142,100%,50%,0.15)]",
      indicator: "bg-emerald-500",
      trendBg: "bg-emerald-500/10",
    },
    amber: {
      gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
      border: "border-amber-500/20 hover:border-amber-500/35",
      text: "text-amber-400",
      glow: "shadow-[0_0_30px_-8px_hsl(43,100%,50%,0.15)]",
      indicator: "bg-amber-500",
      trendBg: "bg-amber-500/10",
    },
    red: {
      gradient: "from-red-500/15 via-red-500/5 to-transparent",
      border: "border-red-500/20 hover:border-red-500/35",
      text: "text-red-400",
      glow: "shadow-[0_0_30px_-8px_hsl(0,80%,50%,0.15)]",
      indicator: "bg-red-500",
      trendBg: "bg-red-500/10",
    },
    neutral: {
      gradient: "from-muted/20 via-muted/5 to-transparent",
      border: "border-border/20 hover:border-border/35",
      text: "text-muted-foreground",
      glow: "",
      indicator: "bg-muted-foreground/50",
      trendBg: "bg-muted/20",
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card, i) => {
        const style = accentStyles[card.accent];
        const TrendIcon = card.trendIcon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`relative overflow-hidden rounded-2xl border ${style.border} bg-card/60 backdrop-blur-xl p-6 ${style.glow} group transition-all duration-500`}
          >
            {/* Gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} pointer-events-none`} />

            <div className="relative z-10">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl bg-background/40 ${style.text}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                {card.badge && (
                  <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-md ${
                    card.badge === "REALIZADO"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-neon-blue/10 text-neon-blue border border-neon-blue/20"
                  }`}>
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                {card.label}
              </p>

              {/* Value - BIG */}
              <div className="flex items-end gap-2 mb-3">
                <p className={`text-3xl font-display font-bold tracking-tight ${style.text} leading-none`}>
                  {card.value}
                </p>
                {(card as any).valueSuffix && (
                  <span className="text-xs text-muted-foreground/50 font-mono mb-0.5">
                    {(card as any).valueSuffix}
                  </span>
                )}
              </div>

              {/* Trend indicator */}
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-md ${style.trendBg}`}>
                  <TrendIcon className={`w-3 h-3 ${style.text}`} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground/50">
                  {card.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
