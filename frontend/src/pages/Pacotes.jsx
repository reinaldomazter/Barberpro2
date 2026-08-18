import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Pacotes() {
  const [data, setData] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: "", valor: 0, validade_dias: 30, status: "Ativo", itens: [] });
  const [del, setDel] = useState(null);

  const load = () => api.get("/pacotes").then(({ data }) => setData(data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); api.get("/servicos").then(({ data }) => setServicos(data)); }, []);

  const openNew = () => { setForm({ nome: "", valor: 0, validade_dias: 30, status: "Ativo", itens: [] }); setEditing(null); setOpen(true); };
  const openEdit = (row) => {
    setForm({ ...row, itens: row.itens.map((i) => ({ servico_id: i.servico_id, quantidade: i.quantidade })) });
    setEditing(row.id); setOpen(true);
  };

  const save = async () => {
    if (!form.nome || form.itens.length === 0) return toast.error("Informe o nome e ao menos um serviço");
    const body = {
      nome: form.nome, valor: Number(form.valor), validade_dias: Number(form.validade_dias),
      status: form.status, itens: form.itens.map((i) => ({ servico_id: Number(i.servico_id), quantidade: Number(i.quantidade) })),
    };
    try {
      if (editing) await api.put(`/pacotes/${editing}`, body);
      else await api.post("/pacotes", body);
      toast.success("Pacote salvo");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async () => {
    try { await api.delete(`/pacotes/${del.id}`); toast.success("Pacote excluído"); setDel(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const setItem = (i, key, v) => {
    const itens = [...form.itens];
    itens[i] = { ...itens[i], [key]: v };
    setForm({ ...form, itens });
  };

  return (
    <div data-testid="page-pacotes">
      <PageHeader title="Pacotes / Assinaturas" subtitle="Combos de serviços com validade e saldo por cliente">
        <Button data-testid="new-button" onClick={openNew} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo pacote
        </Button>
      </PageHeader>

      <DataTable
        testid="data-table"
        columns={[
          { key: "nome", label: "Pacote" },
          { key: "itens", label: "Serviços incluídos", render: (r) => r.itens.map((i) => `${i.quantidade}x ${i.servico}`).join(", ") || "—" },
          { key: "valor", label: "Valor", render: (r) => <span className="mono text-[#D4AF37]">{money(r.valor)}</span> },
          { key: "validade_dias", label: "Validade", render: (r) => `${r.validade_dias} dias` },
          { key: "status", label: "Status" },
        ]}
        data={data}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button data-testid={`edit-${row.id}`} size="sm" variant="ghost" onClick={() => openEdit(row)}>Editar</Button>
            <Button data-testid={`delete-${row.id}`} size="icon" variant="ghost" onClick={() => setDel(row)} className="h-8 w-8 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-2xl" data-testid="form-dialog">
          <DialogHeader><DialogTitle>{editing ? "Editar pacote" : "Novo pacote"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ name: "nome", label: "Nome do pacote" }} value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <Field field={{ name: "valor", label: "Valor (R$)", type: "number" }} value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
            <Field field={{ name: "validade_dias", label: "Validade (dias)", type: "number" }} value={form.validade_dias} onChange={(v) => setForm({ ...form, validade_dias: v })} />
            <Field field={{ name: "status", label: "Status", type: "select", options: ["Ativo", "Inativo"] }} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="label-xs">Serviços incluídos</span>
              <Button data-testid="add-item" size="sm" variant="outline" className="border-zinc-700"
                onClick={() => setForm({ ...form, itens: [...form.itens, { servico_id: "", quantidade: 1 }] })}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {form.itens.map((it, i) => (
                <div key={i} className="flex gap-2 items-end" data-testid={`pacote-item-${i}`}>
                  <div className="flex-1">
                    <Field field={{ name: `servico_${i}`, label: "Serviço", type: "select", options: servicos.map((s) => ({ value: s.id, label: s.nome })) }}
                      value={it.servico_id} onChange={(v) => setItem(i, "servico_id", v)} />
                  </div>
                  <div className="w-24">
                    <Field field={{ name: `qtd_${i}`, label: "Qtd", type: "number" }} value={it.quantidade} onChange={(v) => setItem(i, "quantidade", v)} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-red-400"
                    onClick={() => setForm({ ...form, itens: form.itens.filter((_, x) => x !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="save-button" onClick={save} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={() => setDel(null)}>
        <AlertDialogContent className="bg-[#18181B] border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Excluir o pacote "{del?.nome}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete" onClick={remove} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
