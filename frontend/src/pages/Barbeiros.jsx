import CrudPage from "@/components/CrudPage";
import { money } from "@/api";

export default function Barbeiros() {
  return (
    <CrudPage
      title="Barbeiros"
      subtitle="Cadastro de profissionais e percentual de comissão"
      endpoint="/barbeiros"
      name="barbeiro"
      search
      defaults={{ comissao: 50, status: "Ativo" }}
      fields={[
        { name: "nome", label: "Nome", required: true },
        { name: "cpf", label: "CPF" },
        { name: "telefone", label: "Telefone" },
        { name: "nascimento", label: "Data de nascimento", type: "date" },
        { name: "endereco", label: "Endereço", full: true },
        { name: "comissao", label: "Comissão (%)", type: "number", required: true },
        { name: "status", label: "Status", type: "select", options: ["Ativo", "Inativo"] },
        { name: "observacoes", label: "Observações", type: "textarea", full: true },
      ]}
      columns={[
        { key: "nome", label: "Nome" },
        { key: "telefone", label: "Telefone" },
        { key: "comissao", label: "Comissão", render: (r) => `${r.comissao}%` },
        {
          key: "status", label: "Status",
          render: (r) => (
            <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "Ativo" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-300"}`}>
              {r.status}
            </span>
          ),
        },
        { key: "criado_em", label: "Cadastro", render: (r) => new Date(r.criado_em).toLocaleDateString("pt-BR") },
      ]}
    />
  );
}
