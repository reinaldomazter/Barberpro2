import CrudPage from "@/components/CrudPage";
import { money } from "@/api";

export default function Servicos() {
  return (
    <CrudPage
      title="Serviços"
      subtitle="Serviços oferecidos, preços e duração"
      endpoint="/servicos"
      name="serviço"
      search
      defaults={{ status: "Ativo", duracao: 30 }}
      fields={[
        { name: "nome", label: "Nome do serviço", required: true },
        { name: "preco", label: "Preço (R$)", type: "number", required: true },
        { name: "comissao", label: "Comissão (%) — opcional", type: "number" },
        { name: "duracao", label: "Duração (min)", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["Ativo", "Inativo"] },
        { name: "descricao", label: "Descrição", type: "textarea", full: true },
      ]}
      columns={[
        { key: "nome", label: "Serviço" },
        { key: "preco", label: "Preço", render: (r) => <span className="mono text-[#D4AF37]">{money(r.preco)}</span> },
        { key: "comissao", label: "Comissão", render: (r) => (r.comissao ? `${r.comissao}%` : "Padrão do barbeiro") },
        { key: "duracao", label: "Duração", render: (r) => `${r.duracao} min` },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
