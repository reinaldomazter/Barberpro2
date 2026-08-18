import CrudPage from "@/components/CrudPage";
import { money } from "@/api";

const CATEGORIAS = ["Aluguel", "Energia", "Água", "Internet", "Produtos", "Salários",
  "Comissões", "Manutenção", "Marketing", "Outros"];
const FORMAS = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Outros"];

export default function Despesas() {
  return (
    <CrudPage
      title="Despesas"
      subtitle="Controle financeiro de saídas da barbearia"
      endpoint="/despesas"
      name="despesa"
      search
      defaults={{ data: new Date().toISOString().slice(0, 10), categoria: "Outros", forma_pagamento: "Dinheiro" }}
      fields={[
        { name: "descricao", label: "Descrição", required: true },
        { name: "categoria", label: "Categoria", type: "select", options: CATEGORIAS, required: true },
        { name: "valor", label: "Valor (R$)", type: "number", required: true },
        { name: "data", label: "Data", type: "date", required: true },
        { name: "forma_pagamento", label: "Forma de pagamento", type: "select", options: FORMAS },
        { name: "observacao", label: "Observação", type: "textarea", full: true },
      ]}
      columns={[
        { key: "data", label: "Data", render: (r) => new Date(r.data + "T00:00").toLocaleDateString("pt-BR") },
        { key: "descricao", label: "Descrição" },
        { key: "categoria", label: "Categoria" },
        { key: "valor", label: "Valor", render: (r) => <span className="mono text-red-400">{money(r.valor)}</span> },
        { key: "forma_pagamento", label: "Pagamento" },
      ]}
    />
  );
}
