import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HostStatus, FlowMapHost } from "@/hooks/useFlowMaps";

interface UseFlowMapStatusOptions {
  mapId: string | undefined;
  hosts: FlowMapHost[];
  connectionId: string | undefined;
  refreshInterval: number; // seconds
  enabled?: boolean;
}

/**
 * Polls the flowmap-status edge function for real Zabbix host status.
 * Returns a map of zabbix_host_id → HostStatus.
 * Aborts in-flight requests on unmount and respects refresh_interval.
 */
export function useFlowMapStatus({
  mapId,
  hosts,
  connectionId,
  refreshInterval,
  enabled = true,
}: UseFlowMapStatusOptions) {
  const [statusMap, setStatusMap] = useState<Record<string, HostStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<string>(""); // JSON hash for change detection

  const canPoll = enabled && !!mapId && !!connectionId && hosts.length > 0;

  const fetchStatus = useCallback(async () => {
    if (!mapId || !connectionId) return;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flowmap-status?t=${Date.now()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Cache-Control": "no-cache, no-store",
          },
          body: JSON.stringify({ map_id: mapId, connection_id: connectionId }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const payload = await res.json();
      const hostsData = payload.hosts as Record<string, HostStatus> | undefined;

      if (hostsData) {
        // Only update state if data actually changed (avoid unnecessary re-renders)
        const hash = JSON.stringify(hostsData);
        if (hash !== prevStatusRef.current) {
          prevStatusRef.current = hash;
          setStatusMap(hostsData);
        }
      }
      setError(null);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[FlowMapStatus] poll error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mapId, connectionId]);

  // Setup polling interval
  useEffect(() => {
    if (!canPoll) return;

    // Initial fetch
    fetchStatus();

    // Clamp interval between 10-300s
    const intervalMs = Math.max(10, Math.min(300, refreshInterval)) * 1000;
    intervalRef.current = setInterval(fetchStatus, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [canPoll, fetchStatus, refreshInterval]);

  // Refetch on tab focus (zero-lag strategy)
  useEffect(() => {
    if (!canPoll) return;
    const handler = () => {
      if (document.visibilityState === "visible") fetchStatus();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [canPoll, fetchStatus]);

  return { statusMap, loading, error, refetch: fetchStatus };
}
