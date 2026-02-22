import { motion, AnimatePresence } from "framer-motion";
import type { OLTHealthData } from "./FlowMapCanvas";

interface Props {
  oltHealth: Record<string, OLTHealthData>;
  visible: boolean;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function OLTHealthPanel({ oltHealth, visible }: Props) {
  const olts = Object.values(oltHealth);
  if (olts.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-14 right-3 z-[1000] w-[260px] max-h-[400px] overflow-y-auto"
        >
          <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl">
            <div className="px-3 py-2 border-b border-border/30">
              <h3 className="text-[10px] font-display uppercase tracking-wider text-neon-green font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                OLT Chassis Health
              </h3>
            </div>

            <div className="p-2 space-y-2">
              {olts.map((olt) => {
                const tempColor = olt.temperature == null ? "#9e9e9e"
                  : olt.temperature >= 60 ? "#ff1744"
                  : olt.temperature >= 45 ? "#ff9100"
                  : "#00e676";

                const fanColor = olt.fanStatus === "ACTIVE" ? "#00e676" : olt.fanStatus === "INACTIVE" ? "#ff1744" : "#9e9e9e";
                const cpuColor = olt.cpuLoad == null ? "#9e9e9e"
                  : olt.cpuLoad >= 80 ? "#ff1744"
                  : olt.cpuLoad >= 50 ? "#ff9100"
                  : "#00e676";

                return (
                  <div key={olt.hostId} className="rounded-lg border border-border/30 bg-background/50 p-2.5 space-y-1.5">
                    <div className="text-[10px] font-display font-bold text-foreground/90 truncate">
                      {olt.hostName || `OLT ${olt.hostId.slice(0, 8)}`}
                    </div>

                    {/* Fan */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">🌀 Fans</span>
                      <span className="font-mono font-bold" style={{ color: fanColor }}>
                        {olt.fanStatus ?? "—"}
                        {olt.fanRotation != null && <span className="text-muted-foreground ml-1">({olt.fanRotation}%)</span>}
                      </span>
                    </div>

                    {/* Temperature */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">🌡 Temp</span>
                      <span className="font-mono font-bold" style={{ color: tempColor }}>
                        {olt.temperature != null ? `${olt.temperature}°C` : "—"}
                        <span className="text-muted-foreground/60 ml-1 text-[9px]">(limite: 60°C)</span>
                      </span>
                    </div>

                    {/* Uptime */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">⏱ Uptime</span>
                      <span className="font-mono font-bold text-neon-cyan">{formatUptime(olt.uptime)}</span>
                    </div>

                    {/* CPU */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">⚡ CPU</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(olt.cpuLoad ?? 0, 100)}%`, backgroundColor: cpuColor }} />
                        </div>
                        <span className="font-mono font-bold text-[9px]" style={{ color: cpuColor }}>{olt.cpuLoad != null ? `${olt.cpuLoad.toFixed(0)}%` : "—"}</span>
                      </div>
                    </div>

                    {/* ONU Summary */}
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/20">
                      <span className="text-muted-foreground">📡 ONUs</span>
                      <div className="flex items-center gap-2 font-mono text-[9px]">
                        <span style={{ color: "#00e676" }}>▲{olt.totalOnuOnline}</span>
                        <span style={{ color: "#ff4444" }}>{olt.totalOnuOffline}</span>
                        {olt.totalUnprovisioned > 0 && (
                          <span style={{ color: "#bb86fc" }}>⚙{olt.totalUnprovisioned}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
