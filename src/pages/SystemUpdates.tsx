import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, RefreshCw, Download, Package, Database, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

const CURRENT_VERSION = "2.4.1";

const coreModules = [
  {
    name: "FLOWPULSE Core",
    icon: Zap,
    version: CURRENT_VERSION,
    description: "Motor principal de telemetria e dashboards",
    status: "updated" as const,
  },
  {
    name: "Banco de Inteligência (Geo/ASN)",
    icon: Database,
    version: "1.8.0",
    description: "Base de dados geográfica e de sistemas autônomos",
    status: "updated" as const,
  },
];

const packages = [
  { name: "flowpulse-core", current: "2.4.1", latest: "2.4.1", category: "Core" },
  { name: "flowpulse-bgp-engine", current: "1.6.3", latest: "1.6.3", category: "BGP" },
  { name: "flowpulse-flowmap", current: "3.1.0", latest: "3.1.0", category: "FlowMap" },
  { name: "flowpulse-alerting", current: "1.2.0", latest: "1.2.0", category: "Alertas" },
  { name: "flowpulse-sla-engine", current: "1.0.4", latest: "1.0.4", category: "SLA" },
  { name: "geo-asn-database", current: "1.8.0", latest: "1.8.0", category: "Dados" },
  { name: "telegram-bot-bridge", current: "0.9.1", latest: "0.9.1", category: "Integrações" },
  { name: "zabbix-adapter", current: "2.1.0", latest: "2.1.0", category: "Integrações" },
];

export default function SystemUpdates() {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecking(true);
    setChecked(false);
    setTimeout(() => {
      setChecking(false);
      setChecked(true);
      toast.success("Todos os pacotes estão atualizados!");
    }, 2500);
  };

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide text-foreground">
            Atualizações do Sistema
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Gerencie versões e pacotes do FLOWPULSE INTELLIGENCE
          </p>
        </div>
        <Button
          onClick={handleCheck}
          disabled={checking}
          className="gap-2 font-mono text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Verificando…" : "Verificar Atualizações"}
        </Button>
      </div>

      {/* Core Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {coreModules.map((mod) => (
          <Card key={mod.name} className="glass-card border-border/50">
            <CardContent className="p-5 flex items-center gap-4">
              {checking ? (
                <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <mod.icon className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {checking ? (
                  <>
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-56" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-foreground truncate">
                        {mod.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary shrink-0">
                        v{mod.version}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                  </>
                )}
              </div>
              {!checking && (
                <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-mono gap-1 shrink-0">
                  <CheckCircle className="w-3 h-3" />
                  Atualizado
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Package Table */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Pacotes Instalados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-[10px] font-display uppercase text-muted-foreground h-8 px-4">Pacote</TableHead>
                <TableHead className="text-[10px] font-display uppercase text-muted-foreground h-8 px-4">Categoria</TableHead>
                <TableHead className="text-[10px] font-display uppercase text-muted-foreground h-8 px-4">Versão Atual</TableHead>
                <TableHead className="text-[10px] font-display uppercase text-muted-foreground h-8 px-4">Nova Versão</TableHead>
                <TableHead className="text-[10px] font-display uppercase text-muted-foreground h-8 px-4 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checking
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      <TableCell className="px-4 py-2"><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="px-4 py-2"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="px-4 py-2"><Skeleton className="h-4 w-14" /></TableCell>
                      <TableCell className="px-4 py-2"><Skeleton className="h-4 w-14" /></TableCell>
                      <TableCell className="px-4 py-2 text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                : packages.map((pkg) => {
                    const hasUpdate = pkg.current !== pkg.latest;
                    return (
                      <TableRow key={pkg.name} className="border-border/20 hover:bg-accent/30">
                        <TableCell className="px-4 py-2 font-mono text-xs text-foreground">{pkg.name}</TableCell>
                        <TableCell className="px-4 py-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{pkg.category}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-mono text-xs text-muted-foreground">{pkg.current}</TableCell>
                        <TableCell className="px-4 py-2 font-mono text-xs">
                          {hasUpdate ? (
                            <span className="text-primary font-semibold">{pkg.latest}</span>
                          ) : (
                            <span className="text-muted-foreground">{pkg.latest}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right">
                          {hasUpdate ? (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 font-mono">
                              <Download className="w-3 h-3" /> Instalar
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 font-mono">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono px-1">
        <span>FLOWPULSE INTELLIGENCE v{CURRENT_VERSION}</span>
        {checked && (
          <span className="flex items-center gap-1 text-primary/60">
            <Shield className="w-3 h-3" />
            Última verificação: agora
          </span>
        )}
      </div>
    </div>
  );
}
