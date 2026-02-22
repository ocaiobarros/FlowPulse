import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
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

function fmtBps(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

function tempColor(t: number): string {
  if (t >= 60) return "#ff1744";
  if (t >= 45) return "#ff9100";
  return "#00e676";
}

export default function OLTHealthPanel({ oltHealth, visible }: Props) {
  const olts = Object.values(oltHealth);
  const [expandedOlt, setExpandedOlt] = useState<string | null>(null);

  if (olts.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-14 right-3 z-[1000] w-[280px] max-h-[520px] overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl">
            <div className="px-3 py-2 border-b border-border/30">
              <h3 className="text-[10px] font-display uppercase tracking-wider text-neon-green font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                Saúde Física — Chassi OLT
              </h3>
            </div>

            <div className="p-2 space-y-2">
              {olts.map((olt) => {
                const isExpanded = expandedOlt === olt.hostId;
                const tc = olt.temperature == null ? "#9e9e9e" : tempColor(olt.temperature);
                const fanColor = olt.fanStatus === "ACTIVE" ? "#00e676" : olt.fanStatus === "INACTIVE" ? "#ff1744" : "#9e9e9e";
                const cpuColor = olt.cpuLoad == null ? "#9e9e9e" : olt.cpuLoad >= 80 ? "#ff1744" : olt.cpuLoad >= 50 ? "#ff9100" : "#00e676";

                return (
                  <div key={olt.hostId} className="rounded-lg border border-border/30 bg-background/50 overflow-hidden">
                    {/* Header */}
                    <button
                      onClick={() => setExpandedOlt(isExpanded ? null : olt.hostId)}
                      className="w-full flex items-center justify-between p-2.5 hover:bg-accent/10 transition-colors"
                    >
                      <div className="text-[10px] font-display font-bold text-foreground/90 truncate text-left">
                        {olt.hostName || `OLT ${olt.hostId.slice(0, 8)}`}
                      </div>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Summary row — always visible */}
                    <div className="px-2.5 pb-2 flex items-center gap-3 text-[9px] font-mono">
                      <span style={{ color: fanColor }}>🌀 {olt.fanStatus ?? "—"}{olt.fanRotation != null ? ` ${olt.fanRotation}%` : ""}</span>
                      <span style={{ color: tc }}>🌡 {olt.temperature != null ? `${olt.temperature}°C` : "—"}</span>
                      <span style={{ color: cpuColor }}>⚡ {olt.cpuLoad != null ? `${olt.cpuLoad.toFixed(0)}%` : "—"}</span>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-3 space-y-3 border-t border-border/20 pt-2">
                            {/* Uptime */}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">⏱ Uptime</span>
                              <span className="font-mono font-bold text-neon-cyan">{formatUptime(olt.uptime)}</span>
                            </div>

                            {/* ONU Summary */}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">📡 ONUs</span>
                              <div className="flex items-center gap-2 font-mono text-[9px]">
                                <span style={{ color: "#00e676" }}>▲{olt.totalOnuOnline}</span>
                                <span style={{ color: "#ff4444" }}>▼{olt.totalOnuOffline}</span>
                                {olt.totalUnprovisioned > 0 && <span style={{ color: "#bb86fc" }}>⚙{olt.totalUnprovisioned}</span>}
                              </div>
                            </div>

                            {/* Slot Temperature Bars */}
                            {olt.slotTemperatures && olt.slotTemperatures.length > 0 && (
                              <div>
                                <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1.5">🌡 Temperatura por Slot</div>
                                <div className="space-y-1">
                                  {olt.slotTemperatures.map((st, i) => {
                                    const pct = Math.min((st.temperature / 70) * 100, 100);
                                    const color = tempColor(st.temperature);
                                    return (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="text-[8px] font-mono text-muted-foreground w-12 truncate">{st.slot}</span>
                                        <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                                          <motion.div
                                            className="h-full rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.5, delay: i * 0.05 }}
                                            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                                          />
                                        </div>
                                        <span className="text-[8px] font-mono font-bold w-8 text-right" style={{ color }}>{st.temperature}°C</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Fan Gauge */}
                            {olt.fanRotation != null && (
                              <div>
                                <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1.5">🌀 Fan Gauge</div>
                                <div className="relative h-10 flex items-center justify-center">
                                  <svg viewBox="0 0 100 50" className="w-full h-full">
                                    {/* Background arc */}
                                    <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeLinecap="round" />
                                    {/* Value arc */}
                                    <path
                                      d="M 10 45 A 40 40 0 0 1 90 45"
                                      fill="none"
                                      stroke={fanColor}
                                      strokeWidth="6"
                                      strokeLinecap="round"
                                      strokeDasharray={`${(olt.fanRotation / 100) * 125.6} 125.6`}
                                      style={{ filter: `drop-shadow(0 0 4px ${fanColor}80)` }}
                                    />
                                    <text x="50" y="42" textAnchor="middle" fill={fanColor} fontSize="12" fontFamily="'JetBrains Mono',monospace" fontWeight="700">
                                      {olt.fanRotation}%
                                    </text>
                                  </svg>
                                </div>
                              </div>
                            )}

                            {/* CPU Bar */}
                            {olt.cpuLoad != null && (
                              <div>
                                <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1">⚡ CPU Load</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(olt.cpuLoad, 100)}%` }}
                                      transition={{ duration: 0.5 }}
                                      style={{ backgroundColor: cpuColor, boxShadow: `0 0 6px ${cpuColor}60` }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-mono font-bold" style={{ color: cpuColor }}>{olt.cpuLoad.toFixed(0)}%</span>
                                </div>
                              </div>
                            )}

                            {/* Top 5 PONs */}
                            {olt.topPons && olt.topPons.length > 0 && (
                              <div>
                                <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground mb-1.5">🏆 Top 5 PONs (Tráfego)</div>
                                <div className="space-y-1">
                                  {olt.topPons.map((tp, i) => {
                                    const maxBps = olt.topPons[0]?.trafficBps || 1;
                                    const pct = Math.min((tp.trafficBps / maxBps) * 100, 100);
                                    return (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="text-[8px] font-mono text-neon-cyan font-bold w-3">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[8px] font-mono text-muted-foreground truncate">{tp.pon}</div>
                                          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mt-0.5">
                                            <motion.div
                                              className="h-full rounded-full bg-neon-cyan"
                                              initial={{ width: 0 }}
                                              animate={{ width: `${pct}%` }}
                                              transition={{ duration: 0.5, delay: i * 0.08 }}
                                              style={{ boxShadow: "0 0 4px #00e5ff60" }}
                                            />
                                          </div>
                                        </div>
                                        <span className="text-[8px] font-mono font-bold text-neon-cyan w-14 text-right shrink-0">{fmtBps(tp.trafficBps)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
