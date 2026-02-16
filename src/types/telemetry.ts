/**
 * Canonical telemetry envelope.
 * One payload serves stat, gauge, timeseries, table, and text widgets.
 */

export type TelemetryType = "stat" | "gauge" | "timeseries" | "table" | "text";

export interface TelemetryPoint {
  ts: number;   // epoch ms
  value: number;
}

export interface TelemetryStatData {
  value: number;
  unit?: string;
  trend?: number;        // delta vs previous
  min?: number;
  max?: number;
}

export interface TelemetryGaugeData {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  thresholds?: number[]; // e.g. [60, 80, 95]
}

export interface TelemetryTimeseriesData {
  points: TelemetryPoint[];
  unit?: string;
  label?: string;
}

export interface TelemetryTableData {
  columns: string[];
  rows: unknown[][];
}

export interface TelemetryTextData {
  text: string;
  format?: "plain" | "markdown";
}

export type TelemetryData =
  | TelemetryStatData
  | TelemetryGaugeData
  | TelemetryTimeseriesData
  | TelemetryTableData
  | TelemetryTextData;

export interface TelemetryEnvelope {
  tenant_id: string;
  dashboard_id: string;
  key: string;            // dedupe-stable key, e.g. "zbx:host=123:item=456:avg1m"
  type: TelemetryType;
  data: TelemetryData;
  ts: number;             // epoch ms
  meta?: Record<string, unknown>;
}

/** What the Reactor broadcasts via Realtime */
export interface TelemetryBroadcast {
  event: "DATA_UPDATE";
  key: string;
  type: TelemetryType;
  data: TelemetryData;
  ts: number;
}
