import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS = ["Agendado", "Confirmado", "Em atendimento", "Concluído", "Cancelado", "Faltou"];
const CORES = {
  Agendado: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Confirmado: "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30",
  "Em atendimento": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Concluído": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Cancelado: "bg-red-500/15 text-red-300 border-red-500/30",
  Faltou: "bg-zinc-700/50 text-zinc-400 border-zinc-600",
};

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function range(view, ref) {
  if (view === "dia") return [iso(ref), iso(ref)];
  if (view === "semana") {
    const start = addDays(ref, -((ref.getDay() + 6) % 7));
    return [iso(start), iso(addDays(start, 6))];
  }
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return [iso(first), iso(last)];
}

export default function Agendamentos() {
  const [view, setView] = useState("semana");
  const [ref, setRef] = useState(new Date());
  const [items, setItems] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);

  const [inicio, fim] = range(view, ref);

  const load = () => api.get("/agendamentos", { params: { inicio, fim } })
    .then(({ data }) => setItems(data)).catch((e) => toast.error(apiError(e)));

  useEffect(() => { load(); }, [view, ref.toISOString()]);
  useEffect(() => {
    api.get("/clientes").then(({ data }) => setClientes(data));
    api.get("/barbeiros").then(({ data }) => setBarbeiros(data));
    api.get("/servicos").then(({ data }) => setServicos(data));
  }, []);

  const openNew = (data, hora) => {
    setForm({ data: data || iso(ref), hora: hora || "09:00", status: "Agendado" });
    setEditing(null); setOpen(true);
  };

  const save = async () => {
    const body = {
      cliente_id: Number(form.cliente_id), barbeiro_id: Number(form.barbeiro_id),
      servico_id: Number(form.servico_id), data: form.data, hora: form.hora,
      observacoes: form.observacoes || "", status: form.status || "Agendado",
    };
    if (!body.cliente_id || !body.barbeiro_id || !body.servico_id || !body.data || !body.hora)
      return toast.error("Preencha cliente, barbeiro, serviço, data e horário");
    try {
      if (editing) await api.put(`/agendamentos/${editing}`, body);
      else await api.post("/agendamentos", body);
      toast.success("Agendamento salvo");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/agendamentos/${id}/status`, { status }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir este agendamento?")) return;
    try { await api.delete(`/agendamentos/${id}`); toast.success("Agendamento excluído"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const dias = [];
  if (view === "dia") dias.push(iso(ref));
  else if (view === "semana") {
    const start = addDays(ref, -((ref.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) dias.push(iso(addDays(start, i)));
  } else {
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= last; i++) dias.push(iso(new Date(ref.getFullYear(), ref.getMonth(), i)));
  }

  const step = view === "mes" ? 30 : view === "semana" ? 7 : 1;

  return (
    <div data-testid="page-agendamentos">
      <PageHeader title="Agendamentos" subtitle="Calendário por dia, semana e mês">
        <div className="flex items-center gap-1 border border-zinc-700 rounded-md overflow-hidden">
          {["dia", "semana", "mes"].map((v) => (
            <button key={v} data-testid={`view-${v}`} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm capitalize transition-colors duration-200 ${view === v ? "bg-[#D4AF37] text-black font-semibold" : "text-zinc-400 hover:text-white"}`}>
              {v === "mes" ? "mês" : v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button data-testid="prev-period" size="icon" variant="outline" className="border-zinc-700 h-9 w-9" onClick={() => setRef(addDays(ref, -step))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="border-zinc-700 h-9" onClick={() => setRef(new Date())}>Hoje</Button>
          <Button data-testid="next-period" size="icon" variant="outline" className="border-zinc-700 h-9 w-9" onClick={() => setRef(addDays(ref, step))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button data-testid="new-button" onClick={() => openNew()} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo agendamento
        </Button>
      </PageHeader>

      <p className="label-xs mb-3" data-testid="periodo-label">
        {new Date(inicio + "T00:00").toLocaleDateString("pt-BR")} — {new Date(fim + "T00:00").toLocaleDateString("pt-BR")} · {items.length} agendamento(s)
      </p>

      <div className={`grid gap-3 ${view === "dia" ? "grid-cols-1" : view === "semana" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3 xl:grid-cols-5"}`}>
        {dias.map((d) => {
          const doDia = items.filter((i) => i.data === d);
          if (view === "mes" && doDia.length === 0) return null;
          return (
            <div key={d} className="bg-[#18181B] border border-zinc-800 rounded-lg p-3" data-testid={`dia-${d}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">
                  {new Date(d + "T00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </span>
                <button className="text-xs text-[#D4AF37] hover:underline" onClick={() => openNew(d)}>+ novo</button>
              </div>
              <div className="space-y-2">
                {doDia.length === 0 && <p className="text-xs text-muted-foreground">Livre</p>}
                {doDia.map((a) => (
                  <div key={a.id} className={`border rounded-md px-2 py-1.5 text-xs ${CORES[a.status]}`} data-testid={`agendamento-${a.id}`}>
                    <div className="flex justify-between gap-2">
                      <strong className="mono">{a.hora}</strong>
                      <span className="mono">{money(a.preco)}</span>
                    </div>
                    <p className="font-semibold text-white">{a.cliente}</p>
                    <p>{a.servico} · {a.barbeiro}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <select
                        data-testid={`status-${a.id}`}
                        value={a.status}
                        onChange={(e) => setStatus(a.id, e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[11px] text-white"
                      >
                        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="text-[11px] underline" onClick={() => { setForm(a); setEditing(a.id); setOpen(true); }}>editar</button>
                      <button className="text-[11px] underline text-red-300" onClick={() => remove(a.id)}>excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-2xl" data-testid="form-dialog">
          <DialogHeader><DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ name: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) }}
              value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })} />
            <Field field={{ name: "barbeiro_id", label: "Barbeiro", type: "select", options: barbeiros.map((b) => ({ value: b.id, label: b.nome })) }}
              value={form.barbeiro_id} onChange={(v) => setForm({ ...form, barbeiro_id: v })} />
            <Field field={{ name: "servico_id", label: "Serviço", type: "select", options: servicos.map((s) => ({ value: s.id, label: `${s.nome} — ${money(s.preco)}` })) }}
              value={form.servico_id} onChange={(v) => setForm({ ...form, servico_id: v })} />
            <Field field={{ name: "status", label: "Status", type: "select", options: STATUS }} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
            <Field field={{ name: "data", label: "Data", type: "date" }} value={form.data} onChange={(v) => setForm({ ...form, data: v })} />
            <Field field={{ name: "hora", label: "Horário", type: "time" }} value={form.hora} onChange={(v) => setForm({ ...form, hora: v })} />
            <Field field={{ name: "observacoes", label: "Observações", type: "textarea", full: true }} value={form.observacoes} onChange={(v) => setForm({ ...form, observacoes: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="save-button" onClick={save} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
