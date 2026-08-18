import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, KeyRound } from "lucide-react";
import { api, apiError } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CAMPOS = [
  { name: "nome_barbearia", label: "Nome da barbearia" },
  { name: "cnpj", label: "CNPJ" },
  { name: "telefone", label: "Telefone" },
  { name: "whatsapp", label: "WhatsApp" },
  { name: "endereco", label: "Endereço", full: true },
  { name: "logo", label: "Logo (URL ou caminho local)", full: true },
  { name: "horario_funcionamento", label: "Horário de funcionamento" },
  { name: "formas_pagamento", label: "Formas de pagamento (separadas por vírgula)", full: true },
  { name: "comissao_padrao", label: "Comissão padrão (%)", type: "number" },
  { name: "impressora", label: "Impressora" },
];

export default function Configuracoes() {
  const [conf, setConf] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [userOpen, setUserOpen] = useState(false);
  const [form, setForm] = useState({ perfil: "atendente", ativo: 1 });
  const [editing, setEditing] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({});

  const load = () => {
    api.get("/configuracoes").then(({ data }) => setConf(data));
    api.get("/usuarios").then(({ data }) => setUsuarios(data));
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    try { await api.put("/configuracoes", conf); toast.success("Configurações salvas"); }
    catch (e) { toast.error(apiError(e)); }
  };

  const salvarUsuario = async () => {
    try {
      if (editing) await api.put(`/usuarios/${editing}`, form);
      else await api.post("/usuarios", form);
      toast.success("Usuário salvo"); setUserOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const excluirUsuario = async (id) => {
    if (!window.confirm("Excluir este usuário?")) return;
    try { await api.delete(`/usuarios/${id}`); toast.success("Usuário excluído"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const trocarSenha = async () => {
    try {
      await api.post("/auth/change-password", { senha_atual: pwd.atual, nova_senha: pwd.nova });
      toast.success("Senha alterada"); setPwdOpen(false); setPwd({});
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="page-configuracoes">
      <PageHeader title="Configurações" subtitle="Dados da barbearia, usuários e senhas">
        <Button data-testid="alterar-senha" variant="outline" className="border-zinc-700" onClick={() => setPwdOpen(true)}>
          <KeyRound className="h-4 w-4 mr-1" /> Alterar minha senha
        </Button>
        <Button data-testid="salvar-config" onClick={salvar} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </PageHeader>

      <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4 grid sm:grid-cols-2 gap-4">
        {CAMPOS.map((f) => (
          <Field key={f.name} field={f} value={conf[f.name]} onChange={(v) => setConf({ ...conf, [f.name]: v })} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-8 mb-2">
        <h3 className="text-sm font-bold">Usuários do sistema</h3>
        <Button data-testid="novo-usuario" size="sm" onClick={() => { setForm({ perfil: "atendente", ativo: 1 }); setEditing(null); setUserOpen(true); }}
          className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </div>
      <DataTable
        testid="usuarios-table"
        columns={[
          { key: "usuario", label: "Usuário" },
          { key: "nome", label: "Nome" },
          { key: "perfil", label: "Perfil", render: (r) => (r.perfil === "admin" ? "Administrador" : "Atendente") },
          { key: "ativo", label: "Ativo", render: (r) => (r.ativo ? "Sim" : "Não") },
        ]}
        data={usuarios}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" data-testid={`edit-user-${row.id}`} onClick={() => { setForm({ ...row, senha: "" }); setEditing(row.id); setUserOpen(true); }}>Editar</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-400" onClick={() => excluirUsuario(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="usuario-dialog">
          <DialogHeader><DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            {!editing && <Field field={{ name: "usuario", label: "Usuário" }} value={form.usuario} onChange={(v) => setForm({ ...form, usuario: v })} />}
            <Field field={{ name: "nome", label: "Nome" }} value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <Field field={{ name: "senha", label: editing ? "Nova senha (opcional)" : "Senha", type: "password" }} value={form.senha} onChange={(v) => setForm({ ...form, senha: v })} />
            <Field field={{ name: "perfil", label: "Perfil", type: "select", options: [{ value: "admin", label: "Administrador" }, { value: "atendente", label: "Atendente" }] }}
              value={form.perfil} onChange={(v) => setForm({ ...form, perfil: v })} />
            <Field field={{ name: "ativo", label: "Ativo", type: "select", options: [{ value: 1, label: "Sim" }, { value: 0, label: "Não" }] }}
              value={form.ativo} onChange={(v) => setForm({ ...form, ativo: Number(v) })} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setUserOpen(false)}>Cancelar</Button>
            <Button data-testid="salvar-usuario" onClick={salvarUsuario} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="senha-dialog">
          <DialogHeader><DialogTitle>Alterar minha senha</DialogTitle></DialogHeader>
          <Field field={{ name: "atual", label: "Senha atual", type: "password" }} value={pwd.atual} onChange={(v) => setPwd({ ...pwd, atual: v })} />
          <Field field={{ name: "nova", label: "Nova senha", type: "password" }} value={pwd.nova} onChange={(v) => setPwd({ ...pwd, nova: v })} />
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setPwdOpen(false)}>Cancelar</Button>
            <Button data-testid="confirmar-senha" onClick={trocarSenha} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Alterar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
