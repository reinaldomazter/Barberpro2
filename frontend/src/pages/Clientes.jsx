import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, History, Package } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FIELDS = [
  { name: "nome", label: "Nome", required: true },
  { name: "cpf", label: "CPF" },
  { name: "telefone", label: "Telefone", required: true },
  { name: "whatsapp", label: "WhatsApp" },
  { name: "nascimento", label: "Data de nascimento", type: "date" },
  { name: "endereco", label: "Endereço" },
  { name: "observacoes", label: "Observações", type: "textarea", full: true },
];

export default function Clientes() {
  const [data, setData] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hist, setHist] = useState(null);
  const [pacoteOpen, setPacoteOpen] = useState(null);
  const [pacotes, setPacotes] = useState([]);
  const [pacoteSel, setPacoteSel] = useState("");

  const load = async (query = "") => {
    try {
      const { data } = await api.get("/clientes", { params: query ? { q: query } : {} });
      setData(data);
    } catch (e) { toast.error(apiError(e)); }
  };

  useEffect(() => { load(); api.get("/pacotes").then(({ data }) => setPacotes(data)); }, []);

  const save = async () => {
    if (!form.nome || !form.telefone) return toast.error("Nome e telefone são obrigatórios");
    try {
      if (editing) await api.put(`/clientes/${editing}`, form);
      else await api.post("/clientes", form);
      toast.success("Cliente salvo");
      setOpen(false);
      load(q);
    } catch (e) { toast.error(apiError(e)); }
  };

  const openHist = async (row) => {
    try {
      const { data } = await api.get(`/clientes/${row.id}/historico`);
      setHist({ cliente: row, ...data });
    } catch (e) { toast.error(apiError(e)); }
  };

  const contratar = async () => {
    if (!pacoteSel) return toast.error("Selecione um pacote");
    try {
      await api.post("/clientes-pacotes", { cliente_id: pacoteOpen.id, pacote_id: Number(pacoteSel) });
      toast.success("Pacote contratado");
      setPacoteOpen(null);
      setPacoteSel("");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="page-clientes">
      <PageHeader title="Clientes" subtitle="Cadastro, histórico e pacotes contratados">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input data-testid="search-input" placeholder="Nome ou telefone…" value={q}
            onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
            className="pl-9 w-60 bg-zinc-900 border-zinc-700" />
        </div>
        <Button data-testid="new-button" onClick={() => { setForm({}); setEditing(null); setOpen(true); }}
          className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      </PageHeader>

      <DataTable
        testid="data-table"
        columns={[
          { key: "nome", label: "Nome" },
          { key: "telefone", label: "Telefone" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "criado_em", label: "Cadastro", render: (r) => new Date(r.criado_em).toLocaleDateString("pt-BR") },
          { key: "ultimo_atendimento", label: "Último atendimento", render: (r) => r.ultimo_atendimento ? new Date(r.ultimo_atendimento).toLocaleDateString("pt-BR") : "—" },
        ]}
        data={data}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button data-testid={`historico-${row.id}`} size="sm" variant="ghost" onClick={() => openHist(row)} className="hover:text-[#D4AF37]">
              <History className="h-4 w-4 mr-1" /> Histórico
            </Button>
            <Button data-testid={`pacote-${row.id}`} size="sm" variant="ghost" onClick={() => setPacoteOpen(row)} className="hover:text-[#D4AF37]">
              <Package className="h-4 w-4 mr-1" /> Pacote
            </Button>
            <Button data-testid={`edit-${row.id}`} size="sm" variant="ghost" onClick={() => { setForm(row); setEditing(row.id); setOpen(true); }}>
              Editar
            </Button>
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-2xl" data-testid="form-dialog">
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => <Field key={f.name} field={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="save-button" onClick={save} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hist} onOpenChange={() => setHist(null)}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="historico-dialog">
          <DialogHeader><DialogTitle>Histórico — {hist?.cliente.nome}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-zinc-800 rounded-md p-3">
              <p className="label-xs">Total gasto</p>
              <p className="mono text-xl text-[#D4AF37]">{money(hist?.total_gasto)}</p>
            </div>
            <div className="border border-zinc-800 rounded-md p-3">
              <p className="label-xs">Atendimentos</p>
              <p className="mono text-xl">{hist?.qtd}</p>
            </div>
          </div>

          <h4 className="text-sm font-bold mb-2">Pacotes contratados</h4>
          {hist?.pacotes.length === 0 ? <p className="text-sm text-muted-foreground mb-4">Nenhum pacote</p> : (
            <div className="space-y-2 mb-4">
              {hist?.pacotes.map((p) => (
                <div key={p.id} className="border border-zinc-800 rounded-md p-3 text-sm">
                  <div className="flex justify-between">
                    <strong>{p.nome}</strong>
                    <span className="mono text-[#D4AF37]">{money(p.valor)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contratado {new Date(p.data_contratacao + "T00:00").toLocaleDateString("pt-BR")} · vence {new Date(p.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                  </p>
                  {p.saldos.map((s) => (
                    <p key={s.id} className="text-xs mt-1">
                      {s.servico}: usados {s.utilizados} / restantes <strong className="text-emerald-400">{s.total - s.utilizados}</strong>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          <h4 className="text-sm font-bold mb-2">Atendimentos</h4>
          <div className="space-y-2">
            {hist?.atendimentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum atendimento registrado</p>}
            {hist?.atendimentos.map((a) => (
              <div key={a.id} className="border border-zinc-800 rounded-md p-3 text-sm">
                <div className="flex justify-between">
                  <span>{new Date(a.data).toLocaleString("pt-BR")} · {a.barbeiro}</span>
                  <span className="mono text-[#D4AF37]">{money(a.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.itens.map((i) => `${i.descricao}${i.usou_pacote ? " (pacote)" : ""}`).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.pagamentos.map((p) => `${p.forma}: ${money(p.valor)}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pacoteOpen} onOpenChange={() => setPacoteOpen(null)}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="contratar-dialog">
          <DialogHeader><DialogTitle>Contratar pacote — {pacoteOpen?.nome}</DialogTitle></DialogHeader>
          <Field
            field={{ name: "pacote", label: "Pacote", type: "select", options: pacotes.map((p) => ({ value: p.id, label: `${p.nome} — ${money(p.valor)}` })) }}
            value={pacoteSel}
            onChange={setPacoteSel}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPacoteOpen(null)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="contratar-button" onClick={contratar} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Contratar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
