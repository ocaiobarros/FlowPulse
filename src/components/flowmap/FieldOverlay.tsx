import { useState, useRef, useCallback, useEffect } from "react";
import { Crosshair, Camera, Sun, X, ChevronUp, Wifi, WifiOff, Clock, MapPin } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FlowMapHost, HostStatus } from "@/hooks/useFlowMaps";
import type { LinkTraffic } from "@/hooks/useFlowMapStatus";
import type L from "leaflet";

interface Props {
  mapRef: L.Map | null;
  hosts: FlowMapHost[];
  statusMap: Record<string, HostStatus>;
  linkStatuses: Record<string, { status: string; originHost: string; destHost: string }>;
  linkTraffic: Record<string, LinkTraffic>;
  mapId: string;
}

export default function FieldOverlay({ mapRef, hosts, statusMap, linkStatuses, linkTraffic, mapId }: Props) {
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsPos, setGpsPos] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedHost, setSelectedHost] = useState<FlowMapHost | null>(null);
  const [highContrast, setHighContrast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // ─── GPS tracking ───
  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "GPS não suportado", variant: "destructive" });
      return;
    }
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGpsPos(loc);
      },
      (err) => {
        toast({ title: "Erro GPS", description: err.message, variant: "destructive" });
        setGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }, [toast]);

  const stopGps = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.remove();
      gpsMarkerRef.current = null;
    }
  }, []);

  // Update GPS marker on map
  useEffect(() => {
    if (!mapRef || !gpsPos) return;
    const L = (window as any).L;
    if (!L) return;

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLatLng([gpsPos.lat, gpsPos.lon]);
    } else {
      const icon = L.divIcon({
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="width:14px;height:14px;border-radius:50%;background:#2979ff;border:3px solid #fff;box-shadow:0 0 12px #2979ff80;"></div>
        </div>`,
      });
      gpsMarkerRef.current = L.marker([gpsPos.lat, gpsPos.lon], { icon, zIndexOffset: 9999 }).addTo(mapRef);
    }
  }, [mapRef, gpsPos]);

  const centerOnMe = useCallback(() => {
    if (!gpsPos || !mapRef) {
      startGps();
      return;
    }
    mapRef.flyTo([gpsPos.lat, gpsPos.lon], 15, { duration: 1 });
  }, [gpsPos, mapRef, startGps]);

  // Cleanup
  useEffect(() => () => stopGps(), [stopGps]);

  // ─── Host tap handler via custom event ───
  useEffect(() => {
    const handler = (e: Event) => {
      const hostId = (e as CustomEvent).detail;
      const host = hosts.find((h) => h.id === hostId);
      if (host) setSelectedHost(host);
    };
    window.addEventListener("field-host-tap", handler);
    return () => window.removeEventListener("field-host-tap", handler);
  }, [hosts]);

  // ─── High contrast toggle ───
  useEffect(() => {
    const labels = document.querySelectorAll(".fm-label-content");
    labels.forEach((el) => {
      (el as HTMLElement).style.filter = highContrast ? "invert(1)" : "none";
    });
  }, [highContrast]);

  // ─── Photo upload ───
  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedHost) return;

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error("Não autenticado");

      const userId = session.session.user.id;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${mapId}/${selectedHost.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("flowmap-attachments")
        .upload(path, file, { contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("flowmap-attachments").getPublicUrl(path);
      toast({ title: "📸 Foto anexada!", description: urlData.publicUrl.split("/").pop() });
    } catch (err) {
      toast({ title: "Erro no upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [selectedHost, mapId, toast]);

  // ─── Selected host data ───
  const hostStatus = selectedHost ? statusMap[selectedHost.zabbix_host_id] : undefined;
  const stColor = hostStatus?.status === "UP" ? "#00e676" : hostStatus?.status === "DOWN" ? "#ff1744" : "#9e9e9e";

  const fmtBps = (bps: number | null | undefined): string => {
    if (bps == null || bps === 0) return "0";
    if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  return (
    <>
      {/* ── Floating action buttons ── */}
      <div className="absolute bottom-20 right-3 z-[1000] flex flex-col gap-2">
        {/* High contrast toggle */}
        <button
          onClick={() => setHighContrast((p) => !p)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all ${
            highContrast
              ? "bg-amber-400 border-amber-500 text-black"
              : "bg-card/90 backdrop-blur border-border/50 text-muted-foreground"
          }`}
          title="Alto contraste (sol)"
        >
          <Sun className="w-5 h-5" />
        </button>

        {/* GPS button */}
        <button
          onClick={gpsActive ? centerOnMe : startGps}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border transition-all ${
            gpsActive
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-card/90 backdrop-blur border-border/50 text-muted-foreground"
          }`}
          title={gpsActive ? "Centralizar no GPS" : "Ativar GPS"}
        >
          {gpsActive ? <MapPin className="w-6 h-6" /> : <Crosshair className="w-6 h-6" />}
        </button>
      </div>

      {/* ── GPS status indicator ── */}
      {gpsActive && gpsPos && (
        <div className="absolute top-2 left-2 z-[1000] bg-card/80 backdrop-blur rounded-lg px-3 py-1.5 border border-border/50 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>{gpsPos.lat.toFixed(5)}, {gpsPos.lon.toFixed(5)}</span>
        </div>
      )}

      {/* ── Host detail drawer ── */}
      <Drawer open={!!selectedHost} onOpenChange={(open) => !open && setSelectedHost(null)}>
        <DrawerContent className="bg-card border-t border-border/50 max-h-[70vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-sm font-display flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ background: stColor, boxShadow: `0 0 8px ${stColor}80` }}
                />
                {selectedHost?.host_name || selectedHost?.zabbix_host_id}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-3 overflow-y-auto">
            {/* Status card */}
            <div className="rounded-lg bg-background/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="text-sm font-bold" style={{ color: stColor }}>
                  {hostStatus?.status === "UP" ? (
                    <span className="flex items-center gap-1"><Wifi className="w-4 h-4" /> UP</span>
                  ) : hostStatus?.status === "DOWN" ? (
                    <span className="flex items-center gap-1"><WifiOff className="w-4 h-4" /> DOWN</span>
                  ) : "UNKNOWN"}
                </span>
              </div>
              {hostStatus?.latency != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Latência</span>
                  <span className="text-sm font-mono text-neon-cyan">{hostStatus.latency}ms</span>
                </div>
              )}
              {hostStatus?.availability24h != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Disp. 24h</span>
                  <span className="text-sm font-mono text-neon-green">{hostStatus.availability24h.toFixed(1)}%</span>
                </div>
              )}
              {hostStatus?.lastCheck && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Último check</span>
                  <span className="text-xs font-mono text-muted-foreground">{new Date(hostStatus.lastCheck).toLocaleTimeString("pt-BR")}</span>
                </div>
              )}
            </div>

            {/* Host info */}
            <div className="rounded-lg bg-background/50 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Grupo</span>
                <span className="text-xs font-mono">{selectedHost?.host_group || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Coordenadas</span>
                <span className="text-xs font-mono">{selectedHost?.lat.toFixed(5)}, {selectedHost?.lon.toFixed(5)}</span>
              </div>
              {selectedHost?.is_critical && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Criticidade</span>
                  <span className="text-xs font-bold text-neon-red">CRÍTICO</span>
                </div>
              )}
            </div>

            {/* Photo capture */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-neon-green/10 border border-neon-green/30 text-neon-green text-sm font-display hover:bg-neon-green/20 transition-colors disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              {uploading ? "Enviando..." : "Tirar Foto do Equipamento"}
            </button>

            {/* Distance to host */}
            {gpsPos && selectedHost && (
              <div className="text-center text-xs text-muted-foreground">
                📍 Distância estimada: <span className="font-bold text-foreground">
                  {calcDistance(gpsPos.lat, gpsPos.lon, selectedHost.lat, selectedHost.lon).toFixed(1)} km
                </span>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Hidden file input for camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        className="hidden"
      />
    </>
  );
}

// Haversine distance (km)
function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
