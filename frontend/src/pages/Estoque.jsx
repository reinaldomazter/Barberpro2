import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";
import { api, apiError } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Estoque() {
  const [movs, setMovs] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "Entrada", quantidade: 1 });

  const load = () => {
    api.get("/estoque/movimentacoes").then(({ data }) => setMovs(data));
    api.get("/produtos").then(({ data }) => setProdutos(data));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.produto_id || !form.quantidade) return toast.error("Selecione o produto e a quantidade");
    try {
      await api.post("/estoque/movimentacoes", form);
      toast.success("Movimentação registrada");
      setOpen(false);
      setForm({ tipo: "Entrada", quantidade: 1 });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const baixos = produtos.filter((p) => p.estoque <= p.estoque_minimo);

  return (
    <div data-testid="page-estoque">
      <PageHeader title="Estoque" subtitle="Entradas, saídas, ajustes e histórico de movimentações">
        <Button data-testid="new-button" onClick={() => setOpen(true)} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Nova movimentação
        </Button>
      </PageHeader>

      {baixos.length > 0 && (
        <div className="mb-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-lg p-4" data-testid="alerta-estoque-minimo">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="text-sm"><strong>Abaixo do mínimo:</strong> {baixos.map((p) => `${p.nome} (${p.estoque}/${p.estoque_minimo})`).join(", ")}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-bold mb-2">Estoque atual</h3>
          <DataTable
            testid="estoque-table"
            columns={[
              { key: "nome", label: "Produto" },
              { key: "estoque", label: "Qtd", render: (r) => <span className={r.estoque <= r.estoque_minimo ? "text-red-400 font-semibold" : ""}>{r.estoque}</span> },
              { key: "estoque_minimo", label: "Mínimo" },
            ]}
            data={produtos}
          />
        </div>
        <div>
          <h3 className="text-sm font-bold mb-2">Histórico de movimentações</h3>
          <DataTable
            testid="movimentacoes-table"
            columns={[
              { key: "data", label: "Data", render: (r) => new Date(r.data).toLocaleString("pt-BR") },
              { key: "produto", label: "Produto" },
              { key: "tipo", label: "Tipo" },
              { key: "quantidade", label: "Qtd" },
              { key: "motivo", label: "Motivo" },
            ]}
            data={movs}
          />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="form-dialog">
          <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ name: "produto_id", label: "Produto", type: "select", options: produtos.map((p) => ({ value: p.id, label: p.nome })) }}
              value={form.produto_id} onChange={(v) => setForm({ ...form, produto_id: v })} />
            <Field field={{ name: "tipo", label: "Tipo", type: "select", options: ["Entrada", "Saída", "Ajuste"] }}
              value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} />
            <Field field={{ name: "quantidade", label: form.tipo === "Ajuste" ? "Novo saldo" : "Quantidade", type: "number" }}
              value={form.quantidade} onChange={(v) => setForm({ ...form, quantidade: v })} />
            <Field field={{ name: "motivo", label: "Motivo" }} value={form.motivo} onChange={(v) => setForm({ ...form, motivo: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="save-button" onClick={save} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
