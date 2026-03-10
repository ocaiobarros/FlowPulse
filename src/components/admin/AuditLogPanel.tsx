import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  RefreshCw,
  MapPin,
  Cable,
  Bookmark,
  ArrowRight,
  User,
  Clock,
  CalendarDays,
  List,
  AlignLeft,
  X,
  FileText,
  Shield,
  ChevronRight,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, { label: string; icon: typeof MapPin }> = {
  flow_map_ctos: { label: "CTO", icon: MapPin },
  flow_map_cables: { label: "Cabo", icon: Cable },
  flow_map_reservas: { label: "Reserva", icon: Bookmark },
  flow_map_hosts: { label: "Host", icon: MapPin },
  flow_map_links: { label: "Link", icon: Cable },
  dashboards: { label: "Dashboard", icon: MapPin },
  teams: { label: "Time", icon: User },
  profiles: { label: "Perfil", icon: User },
  user_roles: { label: "Papel", icon: User },
  resource_access: { label: "Permissão", icon: Shield },
  tenants: { label: "Organização", icon: MapPin },
  zabbix_connections: { label: "Conexão Zabbix", icon: Cable },
  rms_connections: { label: "Conexão RMS", icon: Cable },
  alert_rules: { label: "Regra de Alerta", icon: MapPin },
  maintenance_windows: { label: "Manutenção", icon: Clock },
  user: { label: "Usuário", icon: User },
  team: { label: "Time", icon: User },
  tenant: { label: "Organização", icon: MapPin },
  dashboard: { label: "Dashboard", icon: MapPin },
  flow_map: { label: "Mapa", icon: MapPin },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: "Criou", color: "text-green-500 bg-green-500/10 border-green-500/30" },
  UPDATE: { label: "Alterou", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  DELETE: { label: "Removeu", color: "text-destructive bg-destructive/10 border-destructive/30" },
  invite_user: { label: "Convidou", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  link_user: { label: "Vinculou", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  unlink_user: { label: "Desvinculou", color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  set_user_role: { label: "Alterou Papel", color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  create_team: { label: "Criou Time", color: "text-green-500 bg-green-500/10 border-green-500/30" },
  delete_team: { label: "Removeu Time", color: "text-destructive bg-destructive/10 border-destructive/30" },
  add_team_member: { label: "Adicionou Membro", color: "text-green-500 bg-green-500/10 border-green-500/30" },
  remove_team_member: { label: "Removeu Membro", color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  grant_access: { label: "Concedeu Acesso", color: "text-green-500 bg-green-500/10 border-green-500/30" },
  revoke_access: { label: "Revogou Acesso", color: "text-destructive bg-destructive/10 border-destructive/30" },
  update_plan: { label: "Alterou Plano", color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  update_tenant: { label: "Editou Org", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  delete_tenant: { label: "Removeu Org", color: "text-destructive bg-destructive/10 border-destructive/30" },
};

const ADMIN_ACTION_OPTIONS = [
  "invite_user", "link_user", "unlink_user", "set_user_role",
  "create_team", "delete_team", "add_team_member", "remove_team_member",
  "grant_access", "revoke_access", "update_plan", "update_tenant", "delete_tenant",
];

function formatFieldChange(key: string, oldVal: unknown, newVal: unknown): string | null {
  if (oldVal === newVal) return null;
  if (key === "updated_at" || key === "created_at") return null;
  const format = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : Number(v).toFixed(2);
    if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
    return String(v).slice(0, 60);
  };
  return `${key}: ${format(oldVal)} → ${format(newVal)}`;
}

function getChangedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    const result = formatFieldChange(key, oldData[key], newData[key]);
    if (result) changes.push(result);
  }
  return changes.slice(0, 5);
}

function getRecordName(data: Record<string, unknown> | null): string {
  if (!data) return "";
  return String(data.name ?? data.label ?? data.host_name ?? data.email ?? data.team_name ?? "").slice(0, 40);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
}

function groupByDay(entries: AuditLogEntry[]): Map<string, AuditLogEntry[]> {
  const map = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const day = new Date(entry.created_at).toLocaleDateString("pt-BR");
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(entry);
  }
  return map;
}

export default function AuditLogPanel() {
  const [source, setSource] = useState<"infra" | "admin">("admin");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const periodStart = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case "1h": return new Date(now.getTime() - 3600_000).toISOString();
      case "24h": return new Date(now.getTime() - 86400_000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 86400_000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 86400_000).toISOString();
      default: return new Date(now.getTime() - 7 * 86400_000).toISOString();
    }
  }, [periodFilter]);

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", source, tableFilter, actionFilter, periodFilter],
    queryFn: async () => {
      if (source === "admin") {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false })
          .limit(500);

        if (actionFilter !== "all") query = query.eq("action", actionFilter);

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((row: any) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          user_id: row.user_id,
          user_email: null,
          action: row.action,
          table_name: row.entity_type ?? "—",
          record_id: row.entity_id,
          old_data: null,
          new_data: row.details ?? null,
          created_at: row.created_at,
        })) as AuditLogEntry[];
      }

      let query = supabase
        .from("flow_audit_logs")
        .select("*")
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false })
        .limit(500);

      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditLogEntry[];
    },
    refetchInterval: 30_000,
  });

  const uniqueUsers = useMemo(() => {
    const items = new Set<string>();
    (logs ?? []).forEach((l) => {
      if (l.user_email) items.add(l.user_email);
      if (l.user_id) items.add(l.user_id);
    });
    return Array.from(items).sort();
  }, [logs]);

  const filtered = (logs ?? []).filter((log) => {
    if (userFilter !== "all" && log.user_email !== userFilter && log.user_id !== userFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const metadataStr = log.new_data ? JSON.stringify(log.new_data).toLowerCase() : "";
    const oldStr = log.old_data ? JSON.stringify(log.old_data).toLowerCase() : "";
    return (
      log.user_email?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.table_name?.toLowerCase().includes(term) ||
      getRecordName(log.new_data ?? log.old_data).toLowerCase().includes(term) ||
      metadataStr.includes(term) ||
      oldStr.includes(term)
    );
  });

  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  const renderLogRow = (log: AuditLogEntry) => {
    const tableInfo = TABLE_LABELS[log.table_name] ?? { label: log.table_name, icon: FileText };
    const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-muted-foreground bg-muted/30 border-border" };
    const TableIcon = tableInfo.icon;
    const recordName = getRecordName(log.new_data ?? log.old_data);
    const changes = log.action === "UPDATE" ? getChangedFields(log.old_data, log.new_data) : [];

    return (
      <button
        key={log.id}
        onClick={() => setSelectedLog(log)}
        className="w-full text-left rounded-lg border border-border bg-card/40 px-4 py-3 hover:bg-muted/30 hover:border-primary/30 transition-colors group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
              <TableIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${actionInfo.color}`}>
                  {actionInfo.label}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {tableInfo.label}
                </Badge>
                {recordName && (
                  <span className="text-xs font-medium text-foreground truncate">{recordName}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">
                  {log.user_email ?? log.user_id?.slice(0, 8) ?? "sistema"}
                </span>
              </div>
              {changes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {changes.map((change, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                      <ArrowRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-muted-foreground font-mono truncate">{change}</span>
                    </div>
                  ))}
                </div>
              )}
              {log.action !== "UPDATE" && recordName && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  <span className="text-foreground font-medium">{recordName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span title={formatDate(log.created_at)}>{timeAgo(log.created_at)}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => { setSource("admin"); setActionFilter("all"); setTableFilter("all"); }}
            className={`px-3 h-9 text-xs font-medium transition-colors ${source === "admin" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            Admin
          </button>
          <button
            onClick={() => { setSource("infra"); setActionFilter("all"); setTableFilter("all"); }}
            className={`px-3 h-9 text-xs font-medium transition-colors ${source === "infra" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            Infraestrutura
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-2.5 h-9 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            title="Lista"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-2.5 h-9 transition-colors ${viewMode === "timeline" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            title="Timeline"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em ações, usuários, metadata..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/50 border-border text-sm h-9"
          />
        </div>

        {source === "infra" && (
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-36 h-9 bg-muted/50 border-border text-xs">
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas tabelas</SelectItem>
              <SelectItem value="flow_map_ctos">CTOs</SelectItem>
              <SelectItem value="flow_map_cables">Cabos</SelectItem>
              <SelectItem value="flow_map_reservas">Reservas</SelectItem>
              <SelectItem value="flow_map_hosts">Hosts</SelectItem>
              <SelectItem value="flow_map_links">Links</SelectItem>
              <SelectItem value="dashboards">Dashboards</SelectItem>
              <SelectItem value="teams">Times</SelectItem>
              <SelectItem value="zabbix_connections">Conexões</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36 h-9 bg-muted/50 border-border text-xs">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            {source === "infra" ? (
              <>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Alteração</SelectItem>
                <SelectItem value="DELETE">Remoção</SelectItem>
              </>
            ) : (
              ADMIN_ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a]?.label ?? a}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44 h-9 bg-muted/50 border-border text-xs">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos usuários</SelectItem>
            {uniqueUsers.map((u) => (
              <SelectItem key={u} value={u}>{u.includes("@") ? u : u.slice(0, 8) + "..."}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-28 h-9 bg-muted/50 border-border text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Última hora</SelectItem>
            <SelectItem value="24h">24 horas</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{filtered.length} evento{filtered.length !== 1 ? "s" : ""}</span>
        {searchTerm && <span>filtrado por &quot;{searchTerm}&quot;</span>}
      </div>

      {/* Log entries */}
      <ScrollArea className="h-[600px]">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum log encontrado</p>
            <p className="text-xs mt-1">Ações administrativas aparecerão aqui automaticamente.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {filtered.map(renderLogRow)}
          </div>
        ) : (
          /* Timeline view */
          <div className="space-y-6">
            {Array.from(dayGroups.entries()).map(([day, entries]) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{day}</span>
                  <span className="text-[10px] text-muted-foreground">({entries.length})</span>
                </div>
                <div className="relative ml-4 border-l-2 border-border pl-6 space-y-3">
                  {entries.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-muted-foreground" };
                    const tableInfo = TABLE_LABELS[log.table_name] ?? { label: log.table_name, icon: FileText };
                    const recordName = getRecordName(log.new_data ?? log.old_data);
                    return (
                      <button
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="w-full text-left relative group"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-background group-hover:bg-primary transition-colors" />
                        <div className="rounded-lg border border-border bg-card/40 px-4 py-2.5 hover:bg-muted/30 hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono w-12">{formatTime(log.created_at)}</span>
                            <Badge variant="outline" className={`text-[10px] ${actionInfo.color}`}>
                              {actionInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{tableInfo.label}</Badge>
                            {recordName && <span className="text-xs text-foreground font-medium truncate">{recordName}</span>}
                            <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                              {log.user_email ?? log.user_id?.slice(0, 8) ?? "sistema"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-primary" />
              Detalhes do Evento
            </SheetTitle>
          </SheetHeader>
          {selectedLog && <EventDetailPanel log={selectedLog} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EventDetailPanel({ log }: { log: AuditLogEntry }) {
  const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-muted-foreground" };
  const tableInfo = TABLE_LABELS[log.table_name] ?? { label: log.table_name, icon: FileText };

  const changes = log.action === "UPDATE" ? getChangedFields(log.old_data, log.new_data) : [];
  const metadata = log.new_data ?? log.old_data;

  return (
    <div className="space-y-6 mt-6">
      {/* Header info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${actionInfo.color}`}>{actionInfo.label}</Badge>
          <Badge variant="outline">{tableInfo.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Ação</span>
            <span className="font-mono text-foreground">{log.action}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Tipo do Alvo</span>
            <span className="font-mono text-foreground">{log.table_name}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Ator</span>
            <span className="font-mono text-foreground text-xs break-all">
              {log.user_email ?? log.user_id ?? "sistema"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Data/Hora</span>
            <span className="font-mono text-foreground text-xs">{formatDate(log.created_at)}</span>
          </div>
          {log.record_id && (
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground block">ID do Alvo</span>
              <span className="font-mono text-foreground text-xs break-all">{log.record_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Changes (UPDATE) */}
      {changes.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Alterações</h4>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            {getChangedFields(log.old_data, log.new_data).map((change, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <ArrowRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="font-mono text-muted-foreground">{change}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Metadata</h4>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Raw IDs */}
      <div>
        <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">IDs</h4>
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
          <div className="text-[11px] font-mono text-muted-foreground">
            <span className="text-foreground">event_id:</span> {log.id}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            <span className="text-foreground">tenant_id:</span> {log.tenant_id}
          </div>
          {log.user_id && (
            <div className="text-[11px] font-mono text-muted-foreground">
              <span className="text-foreground">actor_id:</span> {log.user_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
