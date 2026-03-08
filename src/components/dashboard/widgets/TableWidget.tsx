import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useWidgetData } from "@/hooks/useWidgetData";
import type { TelemetryCacheEntry } from "@/hooks/useDashboardRealtime";
import type { TelemetryTableData } from "@/types/telemetry";

interface Props {
  telemetryKey: string;
  title: string;
  cache: Map<string, TelemetryCacheEntry>;
}

const ROW_HEIGHT = 28;
const VIRTUALIZE_THRESHOLD = 50;

export default function TableWidget({ telemetryKey, title, cache }: Props) {
  const { data } = useWidgetData({ telemetryKey, cache });
  const tableData = data as TelemetryTableData | null;
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => tableData?.rows ?? [], [tableData]);
  const columns = useMemo(() => tableData?.columns ?? [], [tableData]);
  const useVirtual = rows.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  return (
    <div className="glass-card rounded-lg p-4 h-full flex flex-col border border-border/50">
      <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </span>

      {columns.length > 0 && rows.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* Fixed header */}
          <div className="flex border-b border-border/30 shrink-0">
            {columns.map((col, i) => (
              <div key={i} className="flex-1 text-[10px] font-display uppercase text-muted-foreground py-1 px-2">
                {col}
              </div>
            ))}
          </div>

          {/* Scrollable body */}
          <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
            {useVirtual ? (
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((vRow) => {
                  const row = rows[vRow.index] as unknown[];
                  return (
                    <div
                      key={vRow.index}
                      className="flex items-center border-b border-border/20 hover:bg-accent/30"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: ROW_HEIGHT,
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    >
                      {row.map((cell, ci) => (
                        <div key={ci} className="flex-1 text-xs font-mono py-1 px-2 truncate">
                          {String(cell ?? "")}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              rows.map((row, ri) => (
                <div key={ri} className="flex items-center border-b border-border/20 hover:bg-accent/30" style={{ height: ROW_HEIGHT }}>
                  {(row as unknown[]).map((cell, ci) => (
                    <div key={ci} className="flex-1 text-xs font-mono py-1 px-2 truncate">
                      {String(cell ?? "")}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs font-mono">
          Aguardando dados…
        </div>
      )}
    </div>
  );
}
