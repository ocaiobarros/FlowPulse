import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DriverStats, formatNumber, formatDecimal } from "@/lib/fleet-intelligence-utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Props {
  driver: DriverStats | null;
  modelAvg: number;
  open: boolean;
  onClose: () => void;
}

export default function DriverDetailDrawer({ driver, modelAvg, open, onClose }: Props) {
  if (!driver) return null;

  const chartData = driver.daily_entries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      avg: Number(d.avg.toFixed(2)),
      km: d.km,
      liters: d.liters,
    }));

  const isAboveAvg = driver.avg_km_l >= modelAvg;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] border-l border-border/40 p-0 overflow-y-auto"
        style={{
          background: "linear-gradient(180deg, hsl(228 30% 6%) 0%, hsl(230 35% 3%) 100%)",
        }}
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-['Orbitron'] text-lg text-foreground flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: isAboveAvg
                  ? "linear-gradient(135deg, hsl(142 100% 50% / 0.2), hsl(142 100% 50% / 0.05))"
                  : "linear-gradient(135deg, hsl(0 90% 50% / 0.2), hsl(0 90% 50% / 0.05))",
                border: `1px solid ${isAboveAvg ? "hsl(142 100% 50% / 0.4)" : "hsl(0 90% 50% / 0.4)"}`,
                color: isAboveAvg ? "hsl(142 100% 50%)" : "hsl(0 90% 50%)",
              }}
            >
              {driver.driver_name.charAt(0)}
            </div>
            {driver.driver_name}
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 space-y-6 pb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Média KM/L", value: formatDecimal(driver.avg_km_l), icon: isAboveAvg ? TrendingUp : TrendingDown, color: isAboveAvg ? "142 100% 50%" : "0 90% 50%" },
              { label: "KM Total", value: formatNumber(driver.total_km), color: "210 100% 56%" },
              { label: "Diesel (L)", value: formatNumber(driver.total_liters), color: "43 100% 50%" },
              { label: "Registros", value: String(driver.entries_count), color: "186 100% 50%" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg p-3"
                style={{
                  background: `linear-gradient(145deg, hsl(${item.color} / 0.08), hsl(${item.color} / 0.02))`,
                  border: `1px solid hsl(${item.color} / 0.2)`,
                }}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-['JetBrains_Mono']">
                  {item.label}
                </span>
                <p className="text-lg font-bold font-['JetBrains_Mono'] mt-1" style={{ color: `hsl(${item.color})` }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Equipment Info */}
          <div className="glass-card rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Equipamento</p>
            <p className="text-sm font-medium">{driver.equipment_name || "N/A"}</p>
            <p className="text-xs text-muted-foreground">Placa/Frota</p>
            <p className="text-sm font-medium font-['JetBrains_Mono']">{driver.fleet_number || "N/A"}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {driver.is_outlier && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Suspeita de Desvio
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: isAboveAvg ? "hsl(142 100% 50% / 0.4)" : "hsl(0 90% 50% / 0.4)",
                color: isAboveAvg ? "hsl(142 100% 50%)" : "hsl(0 90% 50%)",
              }}
            >
              {isAboveAvg ? "Acima da média do modelo" : "Abaixo da média do modelo"}
            </Badge>
          </div>

          {/* Daily Performance Chart */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-['Orbitron'] mb-3">
              Histórico de Comportamento
            </h3>
            <div className="glass-card rounded-lg p-4" style={{ height: 240 }}>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 14%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(218 12% 42%)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(218 12% 42%)" }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(225 25% 7%)",
                        border: "1px solid hsl(222 15% 18%)",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} km/l`, "Média"]}
                    />
                    <ReferenceLine
                      y={modelAvg}
                      stroke="hsl(43 100% 50%)"
                      strokeDasharray="5 5"
                      label={{ value: `Média Modelo: ${modelAvg.toFixed(2)}`, position: "right", fontSize: 9, fill: "hsl(43 100% 50%)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="hsl(186 100% 50%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(186 100% 50%)" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Dados insuficientes para gráfico
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
