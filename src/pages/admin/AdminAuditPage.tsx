import AdminBreadcrumb from "./AdminBreadcrumb";
import AuditLogPanel from "@/components/admin/AuditLogPanel";

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Audit Explorer" }]} />
      <h2 className="text-xl font-bold text-foreground font-[Orbitron] tracking-wide">Audit Explorer</h2>
      <p className="text-sm text-muted-foreground">
        Investigue ações críticas, rastreie mudanças e analise operações na plataforma.
      </p>
      <AuditLogPanel />
    </div>
  );
}
