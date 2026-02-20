import { useState, useCallback } from 'react';
import { Activity, Server, Database, Power, Loader2, Settings2 } from 'lucide-react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatusCard from '@/components/dashboard/StatusCard';
import TemperatureSection from '@/components/dashboard/TemperatureSection';
import FanSection from '@/components/dashboard/FanSection';
import PowerSection from '@/components/dashboard/PowerSection';
import StorageSection from '@/components/dashboard/StorageSection';
import NetworkSection from '@/components/dashboard/NetworkSection';
import InventorySection from '@/components/dashboard/InventorySection';
import IdracSetupWizard, { loadIdracConfig, clearIdracConfig, type IdracConfig } from '@/components/dashboard/IdracSetupWizard';
import {
  useIdracLive,
  extractStatus,
  extractTemperatures,
  extractFans,
  extractPower,
  extractDisks,
  extractRaid,
  extractNics,
  extractInventory,
} from '@/hooks/useIdracLive';

const Index = () => {
  const [config, setConfig] = useState<IdracConfig | null>(loadIdracConfig);
  const [showSetup, setShowSetup] = useState(!config);
  const { data, dataLoading, lastRefresh, refresh, error, fetchItems } = useIdracLive();

  const handleConfigComplete = useCallback((cfg: IdracConfig) => {
    setConfig(cfg);
    setShowSetup(false);
    fetchItems(cfg.connectionId, cfg.hostId);
  }, [fetchItems]);

  const handleReconfigure = () => {
    clearIdracConfig();
    setConfig(null);
    setShowSetup(true);
  };

  // Show wizard if not configured
  if (showSetup) {
    return <IdracSetupWizard onComplete={handleConfigComplete} existingConfig={config} />;
  }

  // Extracted data
  const status = data ? extractStatus(data) : null;
  const temps = data ? extractTemperatures(data) : null;
  const fans = data ? extractFans(data) : null;
  const power = data ? extractPower(data) : null;
  const disks = data ? extractDisks(data) : null;
  const raid = data ? extractRaid(data) : null;
  const nics = data ? extractNics(data) : null;
  const inventory = data ? extractInventory(data) : null;

  return (
    <div className="min-h-screen bg-background grid-pattern scanlines relative p-4 md:p-6 lg:p-8">
      {/* Ambient glow effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-neon-green/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-neon-blue/3 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[1600px] mx-auto relative z-10">
        {/* Header */}
        <DashboardHeader
          hostName={config?.hostName ?? "T440-MDP"}
          lastRefresh={lastRefresh}
          onRefresh={data ? refresh : undefined}
          isLoading={dataLoading}
        />

        {/* Reconfigure button - subtle top-right */}
        <div className="flex justify-end mb-2 -mt-4">
          <button
            onClick={handleReconfigure}
            className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Settings2 className="w-3 h-3" />
            Reconfigurar
          </button>
        </div>

        {/* Loading state */}
        {dataLoading && !data && (
          <div className="glass-card rounded-xl p-16 text-center">
            <Loader2 className="w-8 h-8 text-neon-green animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-mono">Carregando dados do Zabbix...</p>
            <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">Host: {config?.hostName}</p>
          </div>
        )}

        {error && !data && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-sm text-neon-red font-mono mb-2">Erro ao carregar dados</p>
            <p className="text-[10px] text-muted-foreground font-mono">{error}</p>
            <button onClick={() => config && fetchItems(config.connectionId, config.hostId)} className="mt-3 text-[10px] text-neon-cyan hover:underline font-mono">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Dashboard content */}
        {data && status && (
          <>
            {/* TOPO — Status Rápido */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatusCard title="Status Geral" rawValue={status.overallStatus} icon={<Server className="w-4 h-4 text-muted-foreground" />} delay={0.1} />
              <StatusCard title="Rollup" rawValue={status.rollupStatus} icon={<Activity className="w-4 h-4 text-muted-foreground" />} delay={0.15} />
              <StatusCard title="Storage" rawValue={status.storageStatus} icon={<Database className="w-4 h-4 text-muted-foreground" />} delay={0.2} />
              <StatusCard title="Energia" rawValue={status.powerState} icon={<Power className="w-4 h-4 text-muted-foreground" />} delay={0.25} />
            </div>

            {/* MEIO — Temperatura + Ventilação + Energia */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-1">
                {temps && <TemperatureSection temperatures={temps} />}
              </div>
              <div className="lg:col-span-1">
                {fans && <FanSection fans={fans} />}
              </div>
              <div className="lg:col-span-1">
                {power && <PowerSection powerSupplies={power.supplies} minIdlePower={power.minIdlePower} />}
              </div>
            </div>

            {/* BASE — Armazenamento */}
            {disks && raid && (
              <div className="mb-6">
                <StorageSection disks={disks} raidController={raid.controller} volumes={raid.volumes} />
              </div>
            )}

            {/* Rede */}
            {nics && (
              <div className="mb-6">
                <NetworkSection nics={nics} />
              </div>
            )}

            {/* Inventário */}
            {inventory && (
              <div className="mb-6">
                <InventorySection inventory={inventory} />
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] font-mono text-muted-foreground/50">
            FLOWPULSE | iDRAC — {config?.hostName ?? "T440-MDP"} • Datasource: Zabbix • Refresh: 2min
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
