import { useNavigate } from "react-router-dom";
import { Users, UsersRound } from "lucide-react";
import AdminBreadcrumb from "./AdminBreadcrumb";

const cards = [
  {
    title: "Usuários",
    description: "Gerencie todos os usuários cadastrados na plataforma.",
    icon: Users,
    path: "/app/settings/admin/users",
    color: "border-l-blue-500",
  },
  {
    title: "Times",
    description: "Agrupamentos internos para segmentar áreas e permissões de acesso granulares.",
    icon: UsersRound,
    path: "/app/settings/admin/teams",
    color: "border-l-indigo-500",
  },
];

export default function AdminAccessLanding() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Usuários e Acesso" }]} />

      <div>
        <h2 className="text-xl font-bold text-foreground font-[Orbitron] tracking-wide">Usuários e Acesso</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure acesso para usuários individuais e times.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className={`text-left rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 hover:bg-muted/40 transition-all border-l-4 ${card.color} group`}
          >
            <div className="flex items-center gap-3 mb-3">
              <card.icon className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
              <h3 className="text-sm font-bold text-foreground">{card.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
