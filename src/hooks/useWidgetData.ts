import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { TelemetryData, TelemetryType } from "@/types/telemetry";
import type { TelemetryCacheEntry } from "@/hooks/useDashboardRealtime";

interface UseWidgetDataOptions {
  /** The telemetry key this widget subscribes to */
  telemetryKey: string;
  /** Full cache map from useDashboardRealtime */
  cache: Map<string, TelemetryCacheEntry>;
  /** Rate-limit per widget: minimum ms between re-renders. Default 300ms */
  minIntervalMs?: number;
}

interface WidgetDataState {
  data: TelemetryData | null;
  previousData: TelemetryData | null;
  type: TelemetryType | null;
  ts: number | null;
  /** True when data transitions from null to a value (for enter animations) */
  isInitial: boolean;
}

/**
 * Hook: per-widget data with rate-limiting.
 * Only re-renders when this widget's key changes AND respects minInterval.
 * Exposes previousData for smooth interpolation animations.
 */
export function useWidgetData({
  telemetryKey,
  cache,
  minIntervalMs = 300,
}: UseWidgetDataOptions): WidgetDataState {
  const [state, setState] = useState<WidgetDataState>({
    data: null,
    previousData: null,
    type: null,
    ts: null,
    isInitial: true,
  });

  const lastUpdateRef = useRef(0);
  const pendingRef = useRef<TelemetryCacheEntry | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyUpdate = useCallback((entry: TelemetryCacheEntry) => {
    lastUpdateRef.current = Date.now();
    setState((prev) => ({
      data: entry.data,
      previousData: prev.data,
      type: entry.type,
      ts: entry.ts,
      isInitial: prev.data === null,
    }));
  }, []);

  // Watch cache for this key's changes
  useEffect(() => {
    const entry = cache.get(telemetryKey);
    if (!entry) return;

    // Skip if same ts
    if (entry.ts === state.ts) return;

    const elapsed = Date.now() - lastUpdateRef.current;

    if (elapsed >= minIntervalMs) {
      // Enough time passed, apply immediately
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      applyUpdate(entry);
    } else {
      // Schedule for later (keep only latest)
      pendingRef.current = entry;
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (pendingRef.current) {
            applyUpdate(pendingRef.current);
            pendingRef.current = null;
          }
        }, minIntervalMs - elapsed);
      }
    }
  }, [cache, telemetryKey, state.ts, minIntervalMs, applyUpdate]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return state;
}
