import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import { api, apiError } from "@/api";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Field({ field, value, onChange }) {
  const common =
    "w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]";
  return (
    <div className={field.full ? "sm:col-span-2" : ""}>
      <label className="label-xs block mb-1.5">{field.label}</label>
      {field.type === "select" ? (
        <select
          data-testid={`field-${field.name}`}
          className={common}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {field.options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          data-testid={`field-${field.name}`}
          className={common}
          rows={2}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          data-testid={`field-${field.name}`}
          type={field.type || "text"}
          step={field.type === "number" ? "0.01" : undefined}
          className={common}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function DataTable({ columns, data, actions, testid }) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-x-auto bg-[#18181B]">
      <table className="w-full text-sm" data-testid={testid}>
        <thead>
          <tr className="border-b border-zinc-800">
            {columns.map((c) => (
              <th key={c.key} className="text-left px-4 py-3 label-xs whitespace-nowrap">{c.label}</th>
            ))}
            {actions && <th className="px-4 py-3 label-xs text-right">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
          )}
          {data.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors duration-150">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
              {actions && <td className="px-4 py-2.5 text-right">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CrudPage({
  title, subtitle, endpoint, fields, columns, search = false, name = "registro",
  canEdit = true, canDelete = true, defaults = {},
}) {
  const [data, setData] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaults);
  const [editing, setEditing] = useState(null);
  const [delItem, setDelItem] = useState(null);

  const load = async (query = "") => {
    try {
      const { data } = await api.get(endpoint, { params: query ? { q: query } : {} });
      setData(data);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  useEffect(() => { load(); }, [endpoint]);

  const openNew = () => { setForm(defaults); setEditing(null); setOpen(true); };
  const openEdit = (row) => { setForm(row); setEditing(row.id); setOpen(true); };

  const save = async () => {
    const missing = fields.filter((f) => f.required && !form[f.name]);
    if (missing.length) return toast.error(`Preencha: ${missing.map((m) => m.label).join(", ")}`);
    try {
      if (editing) await api.put(`${endpoint}/${editing}`, form);
      else await api.post(endpoint, form);
      toast.success(editing ? `${name} atualizado` : `${name} cadastrado`);
      setOpen(false);
      load(q);
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async () => {
    try {
      await api.delete(`${endpoint}/${delItem.id}`);
      toast.success(`${name} excluído`);
      setDelItem(null);
      load(q);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid={`page-${endpoint.replace("/", "")}`}>
      <PageHeader title={title} subtitle={subtitle}>
        {search && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              data-testid="search-input"
              placeholder="Buscar…"
              value={q}
              onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
              className="pl-9 w-56 bg-zinc-900 border-zinc-700"
            />
          </div>
        )}
        <Button data-testid="new-button" onClick={openNew} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </PageHeader>

      <DataTable
        testid="data-table"
        columns={columns}
        data={data}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <Button data-testid={`edit-${row.id}`} size="icon" variant="ghost" onClick={() => openEdit(row)} className="h-8 w-8 hover:text-[#D4AF37]">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button data-testid={`delete-${row.id}`} size="icon" variant="ghost" onClick={() => setDelItem(row)} className="h-8 w-8 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="form-dialog">
          <DialogHeader><DialogTitle>{editing ? `Editar ${name}` : `Novo ${name}`}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4 py-2">
            {fields.map((f) => (
              <Field key={f.name} field={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="save-button" onClick={save} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delItem} onOpenChange={() => setDelItem(null)}>
        <AlertDialogContent className="bg-[#18181B] border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir "{delItem?.nome || delItem?.descricao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
