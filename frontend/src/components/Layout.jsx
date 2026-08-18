import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, Scissors, Users, UserCog, Tag, Package, Boxes,
  Wallet, Receipt, BarChart3, Settings, HardDriveDownload, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "@/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarDays, id: "agendamentos" },
  { to: "/atendimentos", label: "Atendimentos", icon: Scissors, id: "atendimentos" },
  { to: "/clientes", label: "Clientes", icon: Users, id: "clientes" },
  { to: "/barbeiros", label: "Barbeiros", icon: UserCog, id: "barbeiros" },
  { to: "/servicos", label: "Serviços", icon: Tag, id: "servicos" },
  { to: "/pacotes", label: "Pacotes", icon: Package, id: "pacotes" },
  { to: "/produtos", label: "Produtos", icon: Boxes, id: "produtos" },
  { to: "/estoque", label: "Estoque", icon: Boxes, id: "estoque" },
  { to: "/caixa", label: "Caixa", icon: Wallet, id: "caixa" },
  { to: "/despesas", label: "Despesas", icon: Receipt, id: "despesas" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, id: "relatorios", admin: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, id: "configuracoes", admin: true },
  { to: "/backup", label: "Backup", icon: HardDriveDownload, id: "backup", admin: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.admin || isAdmin);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside
        data-testid="sidebar"
        className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static z-40 h-full w-[250px] shrink-0 bg-[#09090B] border-r border-zinc-800 flex flex-col transition-transform duration-200 no-print`}
      >
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-[#D4AF37]" />
            <span className="font-extrabold text-lg tracking-tight">
              Barber<span className="text-[#D4AF37]">Pro</span>
            </span>
          </div>
          <p className="label-xs mt-1">Barbearia Corte Certo</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              data-testid={`sidebar-${n.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
                  isActive
                    ? "bg-[#D4AF37]/10 text-[#D4AF37] font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <div className="px-2 pb-2">
            <p className="text-sm font-semibold">{user?.nome}</p>
            <p className="label-xs">{user?.perfil === "admin" ? "Administrador" : "Atendente"}</p>
          </div>
          <button
            data-testid="sidebar-sair"
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800 no-print">
          <button data-testid="menu-toggle" onClick={() => setOpen(!open)} className="text-zinc-300">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-bold">Barber<span className="text-[#D4AF37]">Pro</span></span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex gap-2 flex-wrap no-print">{children}</div>
    </div>
  );
}
