import { useEffect, useRef, useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Users, Scissors, Wallet, Receipt, PiggyBank, AlertTriangle, Cake, MessageCircle } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { toast } from "sonner";

const GOLD = "#D4AF37";
const COLORS = [GOLD, "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];

function Kpi({ label, value, icon: Icon, accent = "text-white", testid }) {
  return (
    <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4" data-testid={testid}>
      <div className="flex items-center justify-between mb-2">
        <span className="label-xs">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
      </div>
      <p className={`text-xl sm:text-2xl font-bold mono ${accent}`}>{value}</p>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-[#18181B] border border-zinc-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const autoBackupRef = useRef(false);

  useEffect(() => {
    api.get("/dashboard").then(({ data }) => setD(data)).catch((e) => toast.error(apiError(e)));
    if (autoBackupRef.current) return;
    autoBackupRef.current = true;
    api.post("/backup/auto").then(({ data }) => {
      if (data.criado) toast.success(`Backup automático concluído: ${data.arquivo}`, { duration: 6000 });
      if (data.motivo === "erro") toast.error("Backup automático falhou. Verifique a pasta de destino em Backup.");
    }).catch(() => {});
  }, []);

  if (!d) return <p className="text-muted-foreground">Carregando painel…</p>;

  const cartao = (d.formas["Cartão de Débito"] || 0) + (d.formas["Cartão de Crédito"] || 0);

  return (
    <div data-testid="page-dashboard">
      <PageHeader title="Painel Principal" subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi testid="kpi-faturamento-dia" label="Faturamento do dia" value={money(d.faturamento_dia)} icon={TrendingUp} accent="text-[#D4AF37]" />
        <Kpi testid="kpi-faturamento-mes" label="Faturamento do mês" value={money(d.faturamento_mes)} icon={TrendingUp} />
        <Kpi testid="kpi-atendimentos-dia" label="Atendimentos hoje" value={d.atendimentos_dia} icon={Scissors} />
        <Kpi testid="kpi-clientes" label="Clientes cadastrados" value={d.clientes} icon={Users} />
        <Kpi testid="kpi-dinheiro" label="Dinheiro" value={money(d.formas["Dinheiro"])} icon={Wallet} />
        <Kpi testid="kpi-pix" label="PIX" value={money(d.formas["PIX"])} icon={Wallet} />
        <Kpi testid="kpi-cartao" label="Cartão" value={money(cartao)} icon={Wallet} />
        <Kpi testid="kpi-outros" label="Outras formas" value={money(d.formas["Outros"])} icon={Wallet} />
        <Kpi testid="kpi-comissoes" label="Comissões (dia)" value={money(d.comissoes_dia)} icon={PiggyBank} />
        <Kpi testid="kpi-despesas" label="Despesas (dia)" value={money(d.despesas_dia)} icon={Receipt} accent="text-red-400" />
        <Kpi testid="kpi-lucro" label="Lucro estimado" value={money(d.lucro_estimado)} icon={TrendingUp} accent="text-emerald-400" />
        <Kpi testid="kpi-atendimentos-mes" label="Atendimentos do mês" value={d.atendimentos_mes} icon={Scissors} />
      </div>

      {d.alertas_estoque.length > 0 && (
        <div className="mt-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-lg p-4" data-testid="alerta-estoque">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="text-sm">
            <strong>Estoque baixo:</strong>{" "}
            {d.alertas_estoque.map((a) => `${a.nome} (${a.estoque})`).join(", ")}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card title="Faturamento diário (14 dias)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.fat_diario}>
              <CartesianGrid stroke="#27272A" vertical={false} />
              <XAxis dataKey="dia" stroke="#71717A" fontSize={11} tickFormatter={(v) => v?.slice(8) + "/" + v?.slice(5, 7)} />
              <YAxis stroke="#71717A" fontSize={11} />
              <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} formatter={(v) => money(v)} />
              <Line type="monotone" dataKey="total" stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Próximos agendamentos">
          <div className="space-y-2 max-h-[240px] overflow-y-auto" data-testid="proximos-agendamentos">
            {d.proximos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>}
            {d.proximos.map((a) => (
              <div key={a.id} className="flex items-center justify-between border border-zinc-800 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{a.cliente}</p>
                  <p className="text-xs text-muted-foreground">{a.servico} · {a.barbeiro}</p>
                </div>
                <div className="text-right">
                  <p className="mono text-sm text-[#D4AF37]">{a.hora}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.data + "T00:00").toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Aniversariantes da semana">
          <div className="space-y-2 max-h-[240px] overflow-y-auto" data-testid="aniversariantes">
            {(d.aniversariantes || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum aniversário nos próximos 7 dias</p>
            )}
            {(d.aniversariantes || []).map((c) => {
              const fone = (c.whatsapp || c.telefone || "").replace(/\D/g, "");
              const msg = encodeURIComponent(`Feliz aniversário, ${c.nome.split(" ")[0]}! Passe na barbearia para comemorar com um corte especial.`);
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 border border-zinc-800 rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5 truncate">
                      <Cake className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" /> {c.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.em_dias === 0 ? "Hoje" : new Date(c.data + "T00:00").toLocaleDateString("pt-BR")} · {c.idade} anos
                    </p>
                  </div>
                  {fone && (
                    <a href={`https://wa.me/55${fone}?text=${msg}`} target="_blank" rel="noreferrer"
                      data-testid={`whatsapp-${c.id}`}
                      className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors duration-200">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Faturamento mensal">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.fat_mensal}>
              <CartesianGrid stroke="#27272A" vertical={false} />
              <XAxis dataKey="mes" stroke="#71717A" fontSize={11} />
              <YAxis stroke="#71717A" fontSize={11} />
              <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} formatter={(v) => money(v)} />
              <Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Serviços mais vendidos">
          {d.top_servicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={d.top_servicos} dataKey="qtd" nameKey="nome" outerRadius={80} label>
                  {d.top_servicos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Desempenho dos barbeiros (mês)">
          <div className="space-y-3" data-testid="desempenho-barbeiros">
            {d.barbeiros.map((b) => (
              <div key={b.nome}>
                <div className="flex justify-between text-sm">
                  <span>{b.nome}</span>
                  <span className="mono text-[#D4AF37]">{money(b.faturamento)}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-[#D4AF37]" style={{ width: `${Math.min(100, (b.faturamento / (d.barbeiros[0]?.faturamento || 1)) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {b.atendimentos} atendimentos · comissão {money(b.comissao)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
