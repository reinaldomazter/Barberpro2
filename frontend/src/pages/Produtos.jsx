import CrudPage from "@/components/CrudPage";
import { money } from "@/api";

export default function Produtos() {
  return (
    <CrudPage
      title="Produtos / Consumo"
      subtitle="Bebidas, cosméticos e demais itens vendidos no atendimento"
      endpoint="/produtos"
      name="produto"
      search
      defaults={{ status: "Ativo", estoque: 0, estoque_minimo: 0 }}
      fields={[
        { name: "nome", label: "Produto", required: true },
        { name: "categoria", label: "Categoria", type: "select", options: ["Bebidas", "Cosméticos", "Acessórios", "Outros"] },
        { name: "preco", label: "Preço de venda (R$)", type: "number", required: true },
        { name: "custo", label: "Custo (R$)", type: "number" },
        { name: "estoque", label: "Estoque", type: "number" },
        { name: "estoque_minimo", label: "Estoque mínimo", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["Ativo", "Inativo"] },
      ]}
      columns={[
        { key: "nome", label: "Produto" },
        { key: "categoria", label: "Categoria" },
        { key: "preco", label: "Venda", render: (r) => <span className="mono">{money(r.preco)}</span> },
        { key: "custo", label: "Custo", render: (r) => <span className="mono text-muted-foreground">{money(r.custo)}</span> },
        {
          key: "estoque", label: "Estoque",
          render: (r) => (
            <span className={r.estoque <= r.estoque_minimo ? "text-red-400 font-semibold" : ""}>
              {r.estoque} {r.estoque <= r.estoque_minimo && "⚠"}
            </span>
          ),
        },
        { key: "estoque_minimo", label: "Mínimo" },
      ]}
    />
  );
}
