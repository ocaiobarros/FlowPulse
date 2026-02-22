import { useState, useCallback } from "react";
import { MapPin, Search, Loader2, X, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ViabilityResult {
  cto_id: string;
  cto_name: string;
  distance_m: number;
  capacity: string;
  occupied_ports: number;
  free_ports: number;
  status_calculated: string;
}

interface Props {
  mapId: string;
  tenantId: string | null;
  /** Called when user wants to pick a point on the map */
  onStartPicking: () => void;
  /** The picked coordinates from the map */
  pickedPoint: { lat: number; lon: number } | null;
  onClearPick: () => void;
}

export default function ViabilityPanel({ mapId, tenantId, onStartPicking, pickedPoint, onClearPick }: Props) {
  const [results, setResults] = useState<ViabilityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!pickedPoint || !tenantId) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.rpc("check_viability", {
        p_lat: pickedPoint.lat,
        p_lon: pickedPoint.lon,
        p_tenant_id: tenantId,
        p_map_id: mapId,
      });
      if (error) throw error;
      setResults((data as unknown as ViabilityResult[]) ?? []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na consulta", description: e.message });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [pickedPoint, tenantId, mapId, toast]);

  const statusColor = (st: string) =>
    st === "OK" ? "text-neon-green" : st === "CRITICAL" ? "text-neon-red" : st === "DEGRADED" ? "text-neon-amber" : "text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-neon-cyan" />
        <span className="text-xs font-display font-bold text-foreground">Viabilidade FTTH</span>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Clique no mapa para verificar a CTO mais próxima (raio de 200m) e portas livres.
      </p>

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 text-[10px] h-7 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
          onClick={onStartPicking}
        >
          <MapPin className="w-3 h-3" />
          {pickedPoint ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lon.toFixed(5)}` : "Selecionar ponto"}
        </Button>
        {pickedPoint && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClearPick}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {pickedPoint && (
        <Button
          size="sm"
          className="w-full gap-1.5 text-[10px] h-7 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Consultar Viabilidade
        </Button>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="rounded-lg bg-neon-red/5 border border-neon-red/20 p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-neon-red mx-auto mb-1" />
          <p className="text-[10px] text-neon-red font-bold">Nenhuma CTO encontrada</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Raio de 200m sem cobertura.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div
              key={r.cto_id}
              className={`rounded-lg p-2.5 border ${i === 0 ? "bg-neon-green/5 border-neon-green/20" : "bg-muted/10 border-border/20"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-display font-bold text-foreground flex items-center gap-1">
                  {i === 0 && <CheckCircle className="w-3 h-3 text-neon-green" />}
                  {r.cto_name || "CTO"}
                </span>
                <span className={`text-[10px] font-bold ${statusColor(r.status_calculated)}`}>
                  {r.status_calculated}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px]">
                <div>
                  <span className="text-muted-foreground">Distância</span>
                  <div className="font-mono font-bold text-neon-cyan">{r.distance_m.toFixed(0)}m</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Portas Livres</span>
                  <div className={`font-mono font-bold ${r.free_ports > 0 ? "text-neon-green" : "text-neon-red"}`}>
                    {r.free_ports}/{r.capacity}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ocupação</span>
                  <div className="font-mono font-bold text-foreground">{r.occupied_ports}/{r.capacity}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
