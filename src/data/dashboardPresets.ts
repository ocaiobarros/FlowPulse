import type { WidgetConfig } from "@/types/builder";
import { createDefaultWidget } from "@/types/builder";

export interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  icon: string;
  /** Accent color for the card */
  accent: string;
  /** Pre-configured widgets */
  widgets: WidgetConfig[];
  /** Dashboard-level settings overrides */
  settings?: Record<string, unknown>;
}

export type PresetCategory =
  | "network"
  | "energy"
  | "servers"
  | "wifi"
  | "datacenter"
  | "security";

export const PRESET_CATEGORIES: { key: PresetCategory; label: string; icon: string; color: string }[] = [
  { key: "network", label: "Network", icon: "Network", color: "#3B82F6" },
  { key: "servers", label: "Servidores", icon: "Server", color: "#39FF14" },
  { key: "datacenter", label: "Data Center", icon: "HardDrive", color: "#F97316" },
  { key: "energy", label: "Energia", icon: "Zap", color: "#FFBF00" },
  { key: "wifi", label: "Wi-Fi / APs", icon: "Wifi", color: "#06B6D4" },
  { key: "security", label: "Segurança", icon: "Shield", color: "#8B5CF6" },
];

/* ── Helper to create widgets with overrides ── */
function w(
  type: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: Partial<WidgetConfig>,
): WidgetConfig {
  const base = createDefaultWidget(type, x, y);
  return {
    ...base,
    title,
    w: width,
    h: height,
    ...extra,
    style: { ...base.style, ...extra?.style },
    extra: { ...base.extra, ...extra?.extra },
  };
}

/* ═══════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════ */

const PRESET_NETWORK_CORE: DashboardPreset = {
  id: "network-core",
  name: "Switches Core",
  description: "Monitoramento centralizado de switches: latência, tráfego top-N e status de portas.",
  category: "network",
  icon: "Network",
  accent: "#3B82F6",
  widgets: [
    w("stat", "Equipamentos Offline", 0, 0, 3, 1, {
      style: { icon: "AlertTriangle", iconColor: "#FF4444", glow: "red" },
    }),
    w("stat", "Latência Média", 3, 0, 4, 1, {
      style: { icon: "Activity", iconColor: "#3B82F6", glow: "blue" },
      extra: { units: "ms" },
    }),
    w("stat", "Menor Uptime", 7, 0, 3, 1, {
      style: { icon: "Clock", iconColor: "#F97316", glow: "amber" },
    }),
    w("gauge", "CPU Core", 0, 1, 3, 2, {
      style: { glow: "green" },
      extra: { units: "%" },
    }),
    w("gauge", "MEM Core", 3, 1, 3, 2, {
      style: { glow: "amber" },
      extra: { units: "%" },
    }),
    w("table", "Top 10 Tráfego", 0, 3, 5, 3, {
      style: { icon: "BarChart3" },
    }),
    w("status", "Switch Core 1 - Status", 6, 1, 3, 1),
    w("status", "Switch Core 2 - Status", 9, 1, 3, 1),
    w("timeseries", "Tráfego Agregado", 6, 3, 6, 3),
  ],
};

const PRESET_SERVERS: DashboardPreset = {
  id: "servers-windows",
  name: "Servidores Windows",
  description: "Visão geral com CPU, MEM, disco, serviços e interfaces de rede.",
  category: "servers",
  icon: "Server",
  accent: "#39FF14",
  widgets: [
    w("stat", "Zabbix Agent", 0, 0, 3, 1, {
      style: { icon: "CheckCircle", iconColor: "#39FF14", glow: "green" },
    }),
    w("stat", "Processos", 0, 1, 3, 1, {
      style: { icon: "Cpu" },
    }),
    w("stat", "Uptime", 0, 2, 3, 1, {
      style: { icon: "Clock", iconColor: "#06B6D4" },
    }),
    w("gauge", "CPU", 3, 0, 3, 2, {
      style: { glow: "green" },
      extra: { units: "%" },
    }),
    w("gauge", "MEM", 6, 0, 3, 2, {
      style: { glow: "amber" },
      extra: { units: "%" },
    }),
    w("gauge", "Disco", 9, 0, 3, 2, {
      style: { glow: "blue" },
      extra: { units: "%" },
    }),
    w("timeseries", "CPU / MEM / Disco", 3, 2, 5, 2),
    w("timeseries", "Download / Upload", 8, 2, 4, 2),
    w("progress", "Memória Usada", 0, 4, 4, 1, {
      extra: { units: "B", max_value: 0 },
    }),
    w("progress", "Disco C:", 4, 4, 4, 1, {
      extra: { units: "B", max_value: 0 },
    }),
    w("table", "Serviços", 0, 5, 6, 3, {
      style: { icon: "List" },
    }),
    w("table", "Filas de Impressão", 6, 5, 6, 3, {
      style: { icon: "Printer" },
    }),
  ],
};

const PRESET_DATACENTER: DashboardPreset = {
  id: "datacenter",
  name: "Data Center",
  description: "Temperatura, umidade, porta do DC, nobreaks e acompanhamento de incidentes.",
  category: "datacenter",
  icon: "HardDrive",
  accent: "#F97316",
  widgets: [
    w("stat", "Porta Data Center", 0, 0, 2, 1, {
      style: { icon: "DoorOpen", glow: "green" },
    }),
    w("stat", "Temp. Piso", 2, 0, 2, 1, {
      style: { icon: "Thermometer", iconColor: "#3B82F6" },
      extra: { units: "°C" },
    }),
    w("stat", "Temp. Ambiente", 4, 0, 2, 1, {
      style: { icon: "Thermometer", iconColor: "#FFBF00", glow: "amber" },
      extra: { units: "°C" },
    }),
    w("stat", "Temp. Nobreak 1", 6, 0, 2, 1, {
      style: { icon: "Thermometer", iconColor: "#39FF14" },
      extra: { units: "°C" },
    }),
    w("stat", "Temp. Nobreak 2", 8, 0, 2, 1, {
      style: { icon: "Thermometer", iconColor: "#39FF14" },
      extra: { units: "°C" },
    }),
    w("stat", "Umidade DC", 10, 0, 2, 1, {
      style: { icon: "Droplets", iconColor: "#06B6D4", glow: "cyan" },
      extra: { units: "%" },
    }),
    w("stat", "Incidentes de Alerta", 0, 1, 3, 2, {
      style: { icon: "AlertTriangle", iconColor: "#FFBF00", glow: "amber" },
    }),
    w("stat", "Incidentes Graves", 0, 3, 3, 2, {
      style: { icon: "AlertOctagon", iconColor: "#FF4444", glow: "red" },
    }),
    w("table", "Incidentes Ativos", 3, 1, 9, 4, {
      style: { icon: "List" },
    }),
    w("timeseries", "Temperatura Histórica", 0, 5, 6, 2),
    w("timeseries", "Umidade Histórica", 6, 5, 6, 2),
  ],
};

const PRESET_ENERGY: DashboardPreset = {
  id: "energy-ups",
  name: "Energia & Nobreaks",
  description: "Tensão de entrada/saída, carga de bateria, temperatura e autonomia dos UPS.",
  category: "energy",
  icon: "Zap",
  accent: "#FFBF00",
  widgets: [
    w("stat", "Tensão Entrada", 0, 0, 3, 1, {
      style: { icon: "Zap", iconColor: "#FFBF00", glow: "amber" },
      extra: { units: "V" },
    }),
    w("stat", "Tensão Saída", 3, 0, 3, 1, {
      style: { icon: "Zap", iconColor: "#39FF14", glow: "green" },
      extra: { units: "V" },
    }),
    w("stat", "Frequência", 6, 0, 3, 1, {
      style: { icon: "Activity", iconColor: "#06B6D4" },
      extra: { units: "Hz" },
    }),
    w("stat", "Autonomia", 9, 0, 3, 1, {
      style: { icon: "Clock", iconColor: "#8B5CF6" },
      extra: { units: "min" },
    }),
    w("progress", "Carga da Bateria", 0, 1, 6, 1, {
      extra: { units: "%", color_map: { "0": "#FF4444", "30": "#FFBF00", "60": "#39FF14" } },
    }),
    w("progress", "Carga de Saída", 6, 1, 6, 1, {
      extra: { units: "%" },
    }),
    w("gauge", "Temp. Bateria", 0, 2, 4, 2, {
      style: { glow: "amber" },
      extra: { units: "°C" },
    }),
    w("timeseries", "Tensão Histórica", 4, 2, 8, 2),
    w("status", "UPS Status", 0, 4, 4, 1, {
      style: { icon: "Power", glow: "green" },
    }),
    w("status", "Bypass Ativo", 4, 4, 4, 1),
    w("stat", "Última Falha", 8, 4, 4, 1, {
      style: { icon: "AlertTriangle", iconColor: "#FF4444" },
    }),
  ],
};

const PRESET_WIFI: DashboardPreset = {
  id: "wifi-aps",
  name: "Visão Macro APs",
  description: "Access Points: clientes conectados, CPU, MEM, satisfação e throughput.",
  category: "wifi",
  icon: "Wifi",
  accent: "#06B6D4",
  widgets: [
    w("stat", "Total Access Points", 0, 0, 3, 1, {
      style: { icon: "Wifi", iconColor: "#06B6D4", glow: "cyan" },
    }),
    w("stat", "Clientes Conectados", 0, 1, 3, 1, {
      style: { icon: "Users", iconColor: "#39FF14" },
    }),
    w("stat", "Clientes 2.4 GHz", 0, 2, 3, 1, {
      style: { icon: "Wifi", iconColor: "#FFBF00" },
    }),
    w("stat", "Clientes 5 GHz", 0, 3, 3, 1, {
      style: { icon: "Wifi", iconColor: "#06B6D4" },
    }),
    w("stat", "Satisfação Média", 0, 4, 3, 1, {
      style: { icon: "ThumbsUp", iconColor: "#39FF14", glow: "green" },
      extra: { units: "%" },
    }),
    w("timeseries", "Throughput Total", 0, 5, 3, 2),
    w("table", "Status dos APs", 3, 0, 9, 4, {
      style: { icon: "Radio" },
    }),
    w("timeseries", "Clientes Conectados (Histórico)", 3, 4, 9, 3),
  ],
};

const PRESET_FIREWALL: DashboardPreset = {
  id: "security-firewall",
  name: "Firewall Checkpoint",
  description: "Throughput WAN, conexões ativas, drops, VPN tunnels e inteligência de ameaças.",
  category: "security",
  icon: "Shield",
  accent: "#8B5CF6",
  widgets: [
    w("stat", "Throughput WAN", 0, 0, 3, 1, {
      style: { icon: "ArrowUpDown", iconColor: "#39FF14", glow: "green" },
      extra: { units: "Gbps" },
    }),
    w("stat", "Conexões Ativas", 3, 0, 3, 1, {
      style: { icon: "Link", iconColor: "#3B82F6" },
    }),
    w("stat", "Firewall Drops", 6, 0, 3, 1, {
      style: { icon: "ShieldAlert", iconColor: "#F97316", glow: "amber" },
      extra: { units: "pps" },
    }),
    w("stat", "Estado da Licença", 9, 0, 3, 1, {
      style: { icon: "KeyRound", iconColor: "#39FF14", glow: "green" },
    }),
    w("progress", "CPU Gateway 1", 0, 1, 4, 1, { extra: { units: "%" } }),
    w("progress", "MEM Gateway 1", 4, 1, 4, 1, { extra: { units: "%" } }),
    w("progress", "Disco Gateway 1", 8, 1, 4, 1, { extra: { units: "%" } }),
    w("table", "VPN Tunnels", 0, 2, 6, 3, {
      style: { icon: "Lock" },
    }),
    w("table", "Top Ameaças", 6, 2, 6, 3, {
      style: { icon: "Skull" },
    }),
    w("timeseries", "Drops Histórico", 0, 5, 12, 2),
  ],
};

export const DASHBOARD_PRESETS: DashboardPreset[] = [
  PRESET_NETWORK_CORE,
  PRESET_SERVERS,
  PRESET_DATACENTER,
  PRESET_ENERGY,
  PRESET_WIFI,
  PRESET_FIREWALL,
];
