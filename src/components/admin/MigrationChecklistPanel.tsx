import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Server,
  Cloud,
  HardDrive,
  Cpu,
  MemoryStick,
  Globe,
  Shield,
  Database,
  Box,
  Rocket,
  Terminal,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  command?: string;
  link?: string;
}

interface ChecklistSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
}

interface PlatformSpec {
  id: string;
  name: string;
  provider: string;
  compatibility: string;
  codeChanges: string;
  effort: string;
  monthlyCost: string;
  os: string[];
  hardware: { cpu: string; ram: string; disk: string; network: string };
  description: string;
  pros: string[];
  cons: string[];
  link: string;
}

const PLATFORMS: PlatformSpec[] = [
  {
    id: "supabase-cloud",
    name: "Supabase Cloud + Vercel/Netlify",
    provider: "Supabase Inc. + Vercel/Netlify",
    compatibility: "100%",
    codeChanges: "3 variáveis de ambiente",
    effort: "4–6 horas",
    monthlyCost: "~$25 (Supabase Pro) + $0–20 (Vercel/Netlify)",
    os: ["N/A — Serviço gerenciado (SaaS)"],
    hardware: {
      cpu: "N/A — Auto-scaling gerenciado",
      ram: "N/A — Plano Pro: 8 GB dedicado para DB",
      disk: "N/A — 8 GB DB incluído, expansível",
      network: "CDN global (Vercel Edge / Netlify Edge)",
    },
    description:
      "Mesma infraestrutura que roda atualmente na Lovable Cloud. Zero refatoração. O SDK supabase-js conecta nativamente, Auth (GoTrue), Realtime (WebSocket), Storage e Edge Functions (Deno) funcionam de forma idêntica.",
    pros: [
      "Zero mudança de código (apenas 3 env vars)",
      "Edge Functions deployam com 1 comando (supabase functions deploy)",
      "Backups automáticos, SSL, CDN incluídos",
      "Escalabilidade automática sem gerenciar infra",
      "Dashboard web para gerenciar DB, Auth, Storage",
    ],
    cons: [
      "Dependência de serviço externo (vendor lock-in leve)",
      "Custo mensal recorrente (~$25+)",
      "Dados fora do Brasil (us-east-1 padrão, opção São Paulo disponível)",
    ],
    link: "https://supabase.com/pricing",
  },
  {
    id: "docker-vps",
    name: "VPS + Docker Compose (Supabase Self-Hosted)",
    provider: "Hetzner / DigitalOcean / AWS EC2 / Contabo / OVH",
    compatibility: "100%",
    codeChanges: "3 variáveis de ambiente",
    effort: "8–10 horas",
    monthlyCost: "€20–50/mês (VPS) — sem licença de software",
    os: [
      "Debian 12 (Bookworm) — RECOMENDADO e TESTADO",
      "Ubuntu 22.04 LTS (Jammy Jellyfish)",
      "Ubuntu 24.04 LTS (Noble Numbat)",
      "Rocky Linux 9 / AlmaLinux 9",
    ],
    hardware: {
      cpu: "Mínimo: 4 vCPUs (x86_64) | Recomendado: 8 vCPUs",
      ram: "Mínimo: 8 GB | Recomendado: 16 GB",
      disk: "Mínimo: 40 GB SSD NVMe | Recomendado: 80 GB SSD NVMe",
      network: "Mínimo: 1 Gbps | IP público fixo + porta 80/443 liberadas",
    },
    description:
      "Stack completa do Supabase rodando em Docker Compose no seu próprio servidor. Inclui Kong (API Gateway), GoTrue (Auth), PostgREST, Realtime, Storage, Edge Runtime e PostgreSQL 15. Paridade funcional 100% com a Cloud. Já configurado em deploy/docker-compose.onprem.yml.",
    pros: [
      "Dados 100% sob seu controle (soberania total)",
      "Sem custo de licença — apenas infraestrutura",
      "Funciona air-gapped (sem internet após instalação)",
      "Já testado e documentado no projeto (docs/ONPREM_DOCKER.md)",
      "Ideal para clientes com requisitos de compliance/LGPD",
    ],
    cons: [
      "Requer conhecimento de Docker e Linux",
      "Backups e SSL são responsabilidade do operador",
      "Atualizações manuais do stack Supabase",
      "Monitoramento de infra deve ser configurado separadamente",
    ],
    link: "https://supabase.com/docs/guides/self-hosting/docker",
  },
  {
    id: "bare-metal",
    name: "Servidor Físico (Bare Metal) + Docker",
    provider: "Hardware próprio / Colocation / Hetzner Dedicated",
    compatibility: "100%",
    codeChanges: "3 variáveis de ambiente",
    effort: "10–14 horas",
    monthlyCost: "Custo de hardware + energia + internet",
    os: [
      "Debian 12 (Bookworm) — RECOMENDADO e TESTADO",
      "Ubuntu 22.04 LTS Server",
      "Rocky Linux 9",
    ],
    hardware: {
      cpu: "Mínimo: Intel Xeon E-2236 / AMD EPYC 7232P (6 cores) | Recomendado: 8+ cores",
      ram: "Mínimo: 16 GB ECC DDR4 | Recomendado: 32 GB ECC DDR4",
      disk: "Mínimo: 2× 240 GB SSD SATA (RAID 1) | Recomendado: 2× 480 GB NVMe (RAID 1)",
      network: "Mínimo: 1 Gbps dedicado | IP fixo público ou VPN site-to-site",
    },
    description:
      "Mesma stack Docker Compose, porém rodando em hardware dedicado. Performance máxima, latência mínima. Ideal para ISPs e datacenters que já possuem infraestrutura física. O pacote .deb (packaging/) permite instalação automatizada no Debian.",
    pros: [
      "Performance máxima — sem overhead de virtualização",
      "Custo total mais baixo a longo prazo",
      "Controle total de hardware e rede",
      "Ideal para ambientes com Zabbix local (baixa latência)",
      "Pacote .deb automatiza instalação completa",
    ],
    cons: [
      "Investimento inicial em hardware",
      "Requer equipe técnica para manutenção física",
      "Redundância e DR são responsabilidade do operador",
      "Sem auto-scaling (dimensionar para pico)",
    ],
    link: "https://www.hetzner.com/dedicated-rootserver",
  },
];

const MIGRATION_STEPS: ChecklistSection[] = [
  {
    id: "prereqs",
    title: "1. Pré-requisitos",
    icon: <Shield className="w-4 h-4" />,
    items: [
      {
        id: "github",
        title: "Conectar repositório ao GitHub",
        description:
          "Em Lovable → Settings → GitHub → Connect. Isso exporta todo o código fonte para um repositório Git que você controla.",
      },
      {
        id: "schema-export",
        title: "Verificar schema SQL completo",
        description:
          "O arquivo deploy/schema_cblabs_full.sql contém todas as 25+ tabelas, 63 RLS policies, 17 funções, enums e triggers. Confirme que está atualizado.",
        command: "cat deploy/schema_cblabs_full.sql | head -20",
      },
      {
        id: "secrets-list",
        title: "Documentar todos os secrets necessários",
        description:
          "8 secrets obrigatórios: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ZABBIX_ENCRYPTION_KEY, FLOWPULSE_WEBHOOK_TOKEN. Opcionais: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RMS_FUELING_API_TOKEN, UPSTASH_REDIS_REST_URL/TOKEN.",
        link: "docs/CONFIG_SECRETS.md",
      },
    ],
  },
  {
    id: "backend",
    title: "2. Provisionar Backend",
    icon: <Database className="w-4 h-4" />,
    items: [
      {
        id: "create-project",
        title: "Criar projeto Supabase (Cloud ou Self-Hosted)",
        description:
          "Cloud: criar em supabase.com. Self-Hosted: usar deploy/docker-compose.onprem.yml. Anotar URL e chaves (anon_key, service_role_key).",
      },
      {
        id: "apply-schema",
        title: "Aplicar schema no banco de dados",
        description:
          "Executar o SQL completo no novo projeto para criar todas as tabelas, policies, funções e enums.",
        command:
          "psql $DATABASE_URL < deploy/schema_cblabs_full.sql",
      },
      {
        id: "configure-secrets",
        title: "Configurar secrets nas Edge Functions",
        description:
          "Adicionar todos os secrets via CLI (supabase secrets set) ou via Docker (.env).",
        command:
          'supabase secrets set ZABBIX_ENCRYPTION_KEY="$(openssl rand -hex 32)" FLOWPULSE_WEBHOOK_TOKEN="$(openssl rand -hex 32)"',
      },
      {
        id: "deploy-functions",
        title: "Deploy das 20+ Edge Functions",
        description:
          "Todas as funções em supabase/functions/ devem ser deployadas. Cloud: via CLI. Self-Hosted: o edge-runtime carrega automaticamente via main router.",
        command: "supabase functions deploy --project-ref SEU_PROJECT_REF",
      },
      {
        id: "seed-admin",
        title: "Criar usuário administrador inicial",
        description:
          "Invocar a Edge Function seed-admin para criar o primeiro usuário admin no novo ambiente.",
        command:
          'curl -X POST $SUPABASE_URL/functions/v1/seed-admin -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d \'{"email":"admin@suaempresa.com","password":"SenhaSegura123!"}\'',
      },
    ],
  },
  {
    id: "frontend",
    title: "3. Build e Deploy do Frontend",
    icon: <Globe className="w-4 h-4" />,
    items: [
      {
        id: "clone-repo",
        title: "Clonar repositório do GitHub",
        description: "Clonar o repo que foi exportado da Lovable.",
        command: "git clone https://github.com/SEU-ORG/flowpulse.git && cd flowpulse",
      },
      {
        id: "env-vars",
        title: "Configurar variáveis de ambiente (.env)",
        description:
          "Criar arquivo .env na raiz com as 3 variáveis do novo projeto Supabase.",
        command:
          'echo \'VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=eyJ...\nVITE_SUPABASE_PROJECT_ID=SEU-PROJECT-ID\' > .env',
      },
      {
        id: "build",
        title: "Build de produção",
        description:
          "Gera a pasta dist/ com todos os assets estáticos otimizados.",
        command: "npm ci && npm run build",
      },
      {
        id: "deploy-frontend",
        title: "Deploy do dist/ na plataforma escolhida",
        description:
          "Vercel: conectar repo GitHub (auto-deploy). Netlify: idem. Nginx: copiar dist/ para /var/www/flowpulse/ e configurar SPA fallback.",
        command:
          "# Vercel\nnpx vercel --prod\n\n# Ou Nginx\ncp -r dist/* /var/www/flowpulse/\nnginx -t && systemctl reload nginx",
      },
    ],
  },
  {
    id: "validation",
    title: "4. Validação e Smoke Test",
    icon: <Rocket className="w-4 h-4" />,
    items: [
      {
        id: "test-login",
        title: "Testar login com admin criado",
        description: "Acessar a URL do frontend e fazer login com o usuário admin criado no passo anterior.",
      },
      {
        id: "test-zabbix",
        title: "Testar conexão Zabbix",
        description:
          "Em Admin Hub → Conexões de Dados → Zabbix, adicionar uma conexão e clicar em 'Testar'.",
      },
      {
        id: "test-dashboard",
        title: "Criar dashboard e verificar polling",
        description:
          "Criar um dashboard, adicionar widgets com itens Zabbix e verificar se os dados atualizam em tempo real.",
      },
      {
        id: "test-flowmap",
        title: "Testar FlowMap (se aplicável)",
        description:
          "Criar um mapa, adicionar hosts e verificar atualização de status via flowmap-status.",
      },
      {
        id: "test-alerts",
        title: "Testar pipeline de alertas",
        description:
          "Enviar um evento teste via webhook para validar alert-ingest → alert_instances → escalonamento.",
        command:
          'curl -X POST $SUPABASE_URL/functions/v1/alert-ingest -H "X-Webhook-Token: SEU_TOKEN" -H "Content-Type: application/json" -d \'{"triggerid":"99999","hostname":"test-host","description":"Smoke Test","status":"PROBLEM","severity":"4"}\'',
      },
      {
        id: "test-telegram",
        title: "Testar notificação Telegram (se configurado)",
        description:
          "Verificar se o bot envia mensagens no chat configurado após um alerta.",
      },
    ],
  },
];

export default function MigrationChecklistPanel() {
  const { toast } = useToast();
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("fp-migration-checklist");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(MIGRATION_STEPS.map((s) => s.id))
  );
  const [selectedPlatform, setSelectedPlatform] = useState<string>("supabase-cloud");

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("fp-migration-checklist", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast({ title: "Copiado!", description: "Comando copiado para a área de transferência." });
  };

  const totalItems = MIGRATION_STEPS.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = MIGRATION_STEPS.reduce(
    (sum, s) => sum + s.items.filter((i) => checked.has(i.id)).length,
    0
  );
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const platform = PLATFORMS.find((p) => p.id === selectedPlatform)!;

  return (
    <div className="space-y-8">
      {/* ─── PROGRESS BAR ─── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground font-[Orbitron]">
            Progresso da Migração
          </h3>
          <Badge variant={progressPct === 100 ? "default" : "secondary"} className="text-sm">
            {completedItems}/{totalItems} — {progressPct}%
          </Badge>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct === 100 && (
          <p className="text-sm text-green-500 font-medium">
            ✅ Todos os passos concluídos! O FlowPulse está pronto para produção.
          </p>
        )}
      </div>

      {/* ─── PLATFORM SELECTOR ─── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-bold text-foreground font-[Orbitron]">
          Plataformas 100% Compatíveis
        </h3>
        <p className="text-sm text-muted-foreground">
          Apenas plataformas com paridade funcional total — sem adaptações, sem gambiarras. O sistema roda de forma idêntica ao ambiente atual.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                selectedPlatform === p.id
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                {p.id === "supabase-cloud" && <Cloud className="w-6 h-6 text-primary shrink-0 mt-0.5" />}
                {p.id === "docker-vps" && <Server className="w-6 h-6 text-primary shrink-0 mt-0.5" />}
                {p.id === "bare-metal" && <HardDrive className="w-6 h-6 text-primary shrink-0 mt-0.5" />}
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{p.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{p.provider}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="text-[10px]">
                  {p.compatibility} compatível
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {p.effort}
                </Badge>
              </div>
            </button>
          ))}
        </div>

        {/* ─── SELECTED PLATFORM DETAILS ─── */}
        {platform && (
          <div className="mt-6 space-y-6 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-foreground">{platform.name}</h4>
              <a
                href={platform.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Documentação <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-sm text-muted-foreground">{platform.description}</p>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Compatibilidade</p>
                <p className="text-sm font-bold text-green-500">{platform.compatibility}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Mudanças no Código</p>
                <p className="text-sm font-bold text-foreground">{platform.codeChanges}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Esforço Estimado</p>
                <p className="text-sm font-bold text-foreground">{platform.effort}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Custo Mensal</p>
                <p className="text-sm font-bold text-foreground">{platform.monthlyCost}</p>
              </div>
            </div>

            {/* Hardware Specs */}
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" /> Especificações de Hardware
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CPU</p>
                  <p className="text-xs text-foreground">{platform.hardware.cpu}</p>
                </div>
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Memória RAM</p>
                  <p className="text-xs text-foreground">{platform.hardware.ram}</p>
                </div>
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Armazenamento</p>
                  <p className="text-xs text-foreground">{platform.hardware.disk}</p>
                </div>
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rede</p>
                  <p className="text-xs text-foreground">{platform.hardware.network}</p>
                </div>
              </div>
            </div>

            {/* OS */}
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Sistemas Operacionais Compatíveis
              </h5>
              <div className="flex flex-wrap gap-2">
                {platform.os.map((os) => (
                  <Badge key={os} variant="outline" className="text-xs py-1 px-3">
                    {os}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Pros / Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-green-500">✅ Vantagens</h5>
                <ul className="space-y-1">
                  {platform.pros.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-orange-400">⚠️ Considerações</h5>
                <ul className="space-y-1">
                  {platform.cons.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── CHECKLIST ─── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground font-[Orbitron]">
            Checklist de Migração
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setChecked(new Set());
              localStorage.removeItem("fp-migration-checklist");
            }}
            className="text-xs text-muted-foreground"
          >
            Resetar
          </Button>
        </div>

        <div className="space-y-4">
          {MIGRATION_STEPS.map((section) => {
            const sectionCompleted = section.items.filter((i) => checked.has(i.id)).length;
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {section.icon}
                    <span className="text-sm font-semibold text-foreground">{section.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {sectionCompleted}/{section.items.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-border">
                    {section.items.map((item) => {
                      const isDone = checked.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-4 space-y-2 transition-colors ${
                            isDone ? "bg-primary/5 opacity-70" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleCheck(item.id)}
                              className="mt-0.5 shrink-0"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                              )}
                            </button>
                            <div className="flex-1 space-y-1">
                              <p
                                className={`text-sm font-medium ${
                                  isDone
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                }`}
                              >
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.description}
                              </p>
                              {item.command && (
                                <div className="mt-2 relative group">
                                  <pre className="bg-background border border-border rounded-md p-3 text-[11px] text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
                                    {item.command}
                                  </pre>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                    onClick={() => copyCommand(item.command!)}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                              {item.link && (
                                <a
                                  href={item.link}
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                >
                                  Ver documentação <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── INCOMPATIBLE PLATFORMS ─── */}
      <div className="bg-card border border-destructive/30 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-destructive font-[Orbitron]">
          ⛔ Plataformas Incompatíveis
        </h3>
        <p className="text-sm text-muted-foreground">
          As seguintes plataformas exigiriam reescrita significativa do código e NÃO garantem paridade funcional.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Plataforma</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Problema</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Esforço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 px-3 text-foreground">Firebase</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">SDK incompatível, Auth diferente (Firebase Auth ≠ GoTrue), sem PostgREST, sem Edge Functions Deno</td>
                <td className="py-2 px-3"><Badge variant="destructive" className="text-[10px]">Reescrita total</Badge></td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-foreground">PlanetScale / Neon</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">Apenas banco de dados. Sem Auth, sem Edge Functions, sem Storage, sem Realtime</td>
                <td className="py-2 px-3"><Badge variant="destructive" className="text-[10px]">5000+ linhas</Badge></td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-foreground">AWS Amplify</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">SDK próprio (aws-amplify), Auth Cognito incompatível com GoTrue, AppSync ≠ PostgREST</td>
                <td className="py-2 px-3"><Badge variant="destructive" className="text-[10px]">200+ horas</Badge></td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-foreground">Backend Express/Fastify</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">Reescrever 20+ Edge Functions, reimplementar Auth, RLS, Realtime, Storage</td>
                <td className="py-2 px-3"><Badge variant="destructive" className="text-[10px]">25–42 dias</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
