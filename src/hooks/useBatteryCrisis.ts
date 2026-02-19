import { useState, useEffect, useRef, useCallback } from "react";
import type { TelemetryCacheEntry } from "@/hooks/useDashboardRealtime";
import { extractRawValue } from "@/lib/telemetry-utils";

interface BatteryCrisisOptions {
  /** Telemetry cache from the dashboard */
  cache: Map<string, TelemetryCacheEntry>;
  /** Keys to monitor for battery voltage (checks all, triggers on any) */
  batteryKeys: string[];
  /** Voltage at or below which crisis activates. Default: 44.0 */
  crisisThreshold?: number;
  /** Voltage above which crisis deactivates (hysteresis). Default: 44.5 */
  recoveryThreshold?: number;
  /** Whether the global audio system is muted */
  globalMuted?: boolean;
}

interface BatteryCrisisState {
  /** True when any monitored battery is in crisis */
  isCrisis: boolean;
  /** The voltage that triggered (lowest seen) */
  crisisVoltage: number | null;
  /** User has silenced the alarm for this crisis episode */
  isSilenced: boolean;
  /** Silence the current alarm */
  silenceAlarm: () => void;
}

/**
 * Monitors battery voltage keys in the telemetry cache.
 * Activates crisis at ≤ crisisThreshold, deactivates at > recoveryThreshold (hysteresis).
 * Plays persistent 880Hz beep every 1.5s while crisis is active and not silenced.
 */
export function useBatteryCrisis({
  cache,
  batteryKeys,
  crisisThreshold = 44.0,
  recoveryThreshold = 44.5,
  globalMuted = false,
}: BatteryCrisisOptions): BatteryCrisisState {
  const [isCrisis, setIsCrisis] = useState(false);
  const [isSilenced, setIsSilenced] = useState(false);
  const [crisisVoltage, setCrisisVoltage] = useState<number | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasCrisisRef = useRef(false);

  // Scan cache for lowest battery voltage
  const lowestVoltage = (() => {
    let min = Infinity;
    for (const key of batteryKeys) {
      const entry = cache.get(key);
      if (!entry) continue;
      const raw = extractRawValue(entry.data);
      if (raw === null) continue;
      const v = parseFloat(raw);
      if (!isNaN(v) && v < min) min = v;
    }
    return min === Infinity ? null : min;
  })();

  // Hysteresis logic
  useEffect(() => {
    if (lowestVoltage === null) return;

    if (!wasCrisisRef.current && lowestVoltage <= crisisThreshold) {
      // Enter crisis
      wasCrisisRef.current = true;
      setIsCrisis(true);
      setIsSilenced(false);
      setCrisisVoltage(lowestVoltage);
    } else if (wasCrisisRef.current && lowestVoltage > recoveryThreshold) {
      // Exit crisis
      wasCrisisRef.current = false;
      setIsCrisis(false);
      setCrisisVoltage(null);
    } else if (wasCrisisRef.current && lowestVoltage !== null) {
      setCrisisVoltage(lowestVoltage);
    }
  }, [lowestVoltage, crisisThreshold, recoveryThreshold]);

  // Audio beep engine
  const playBeep = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch {
      // Audio not available
    }
  }, []);

  // Start/stop persistent beep interval
  useEffect(() => {
    if (isCrisis && !isSilenced && !globalMuted) {
      // Play immediately, then every 1.5s
      playBeep();
      intervalRef.current = setInterval(playBeep, 1500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCrisis, isSilenced, globalMuted, playBeep]);

  const silenceAlarm = useCallback(() => {
    setIsSilenced(true);
  }, []);

  return { isCrisis, crisisVoltage, isSilenced, silenceAlarm };
}
