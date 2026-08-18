import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Download, FileText } from "lucide-react";
import { api, apiError, money, API_URL } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";

const TIPOS = [
  { id: "financeiro", label: "Financeiro" },
  { id: "barbeiros", label: "Barbeiros" },
  { id: "clientes", label: "Clientes" },
  { id: "servicos", label: "Serviços" },
  { id: "produtos", label: "Produtos" },
];

const COLS = {
  diario: [{ key: "periodo", label: "Dia" }, { key: "atendimentos", label: "Atendimentos" }, { key: "faturamento", label: "Faturamento", render: (r) => money(r.faturamento) }],
  mensal: [{ key: "periodo", label: "Mês" }, { key: "atendimentos", label: "Atendimentos" }, { key: "faturamento", label: "Faturamento", render: (r) => money(r.faturamento) }],
  despesas: [{ key: "categoria", label: "Categoria" }, { key: "valor", label: "Valor", render: (r) => money(r.valor) }],
  barbeiros: [{ key: "nome", label: "Barbeiro" }, { key: "atendimentos", label: "Atendimentos" }, { key: "faturamento", label: "Faturamento", render: (r) => money(r.faturamento) }, { key: "comissao", label: "Comissão", render: (r) => money(r.comissao) }],
  cadastrados: [{ key: "nome", label: "Cliente" }, { key: "telefone", label: "Telefone" }, { key: "cadastro", label: "Cadastro" }],
  mais_gastam: [{ key: "nome", label: "Cliente" }, { key: "atendimentos", label: "Atendimentos" }, { key: "total", label: "Total gasto", render: (r) => money(r.total) }],
  inativos: [{ key: "nome", label: "Cliente" }, { key: "telefone", label: "Telefone" }, { key: "ultimo_atendimento", label: "Último atendimento", render: (r) => r.ultimo_atendimento ? new Date(r.ultimo_atendimento).toLocaleDateString("pt-BR") : "Nunca" }],
  servicos: [{ key: "nome", label: "Serviço" }, { key: "quantidade", label: "Quantidade" }, { key: "faturamento", label: "Faturamento", render: (r) => money(r.faturamento) }],
  vendidos: [{ key: "nome", label: "Produto" }, { key: "quantidade", label: "Quantidade" }, { key: "faturamento", label: "Faturamento", render: (r) => money(r.faturamento) }],
  estoque: [{ key: "nome", label: "Produto" }, { key: "categoria", label: "Categoria" }, { key: "estoque", label: "Estoque" }, { key: "estoque_minimo", label: "Mínimo" }, { key: "preco", label: "Preço", render: (r) => money(r.preco) }],
  abaixo_minimo: [{ key: "nome", label: "Produto" }, { key: "estoque", label: "Estoque" }, { key: "estoque_minimo", label: "Mínimo" }],
};

const TITULOS = {
  diario: "Faturamento diário", mensal: "Faturamento mensal", despesas: "Despesas por categoria",
  barbeiros: "Desempenho dos barbeiros", cadastrados: "Clientes cadastrados no período",
  mais_gastam: "Clientes que mais gastam", inativos: "Clientes sem retorno (30+ dias)",
  servicos: "Serviços mais vendidos", vendidos: "Produtos vendidos/consumidos",
  estoque: "Estoque atual", abaixo_minimo: "Produtos abaixo do estoque mínimo",
};

export default function Relatorios() {
  const first = new Date();
  const [tipo, setTipo] = useState("financeiro");
  const [inicio, setInicio] = useState(new Date(first.getFullYear(), first.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/relatorios/${tipo}`, { params: { inicio, fim } });
      setData(data);
    } catch (e) { toast.error(apiError(e)); }
  };

  useEffect(() => { load(); }, [tipo, inicio, fim]);

  const baixar = (formato, secao) => {
    const token = localStorage.getItem("bp_token");
    const query = `inicio=${inicio}&fim=${fim}${secao ? `&secao=${secao}` : ""}`;
    fetch(`${API_URL}/relatorios/${tipo}/${formato}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tipo}_${secao || "completo"}_${inicio}_${fim}.${formato}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(`Falha ao exportar ${formato.toUpperCase()}`));
  };

  const exportCsv = (secao) => baixar("csv", secao);
  const exportPdf = (secao) => baixar("pdf", secao);

  const secoes = data ? Object.keys(data).filter((k) => Array.isArray(data[k])) : [];

  return (
    <div data-testid="page-relatorios">
      <PageHeader title="Relatórios" subtitle="Filtre por período, imprima ou exporte em PDF e CSV">
        <select data-testid="tipo-relatorio" value={tipo} onChange={(e) => setTipo(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm">
          {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input type="date" data-testid="inicio" value={inicio} onChange={(e) => setInicio(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
        <input type="date" data-testid="fim" value={fim} onChange={(e) => setFim(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
        <Button data-testid="imprimir" variant="outline" className="border-zinc-700" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir
        </Button>
        <Button data-testid="pdf-completo" onClick={() => exportPdf(null)} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <FileText className="h-4 w-4 mr-1" /> PDF completo
        </Button>
      </PageHeader>

      {data?.resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="resumo-financeiro">
          {[["Faturamento", data.resumo.faturamento, "text-[#D4AF37]"], ["Despesas", data.resumo.despesas, "text-red-400"],
            ["Comissões", data.resumo.comissoes, ""], ["Lucro estimado", data.resumo.lucro, "text-emerald-400"]].map(([l, v, c]) => (
            <div key={l} className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
              <p className="label-xs mb-1">{l}</p>
              <p className={`mono text-xl font-bold ${c}`}>{money(v)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {secoes.map((s) => (
          <div key={s}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{TITULOS[s] || s}</h3>
              <div className="flex gap-2">
              <Button data-testid={`export-pdf-${s}`} size="sm" variant="outline" className="border-zinc-700 no-print" onClick={() => exportPdf(s)}>
                <FileText className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
              <Button data-testid={`export-${s}`} size="sm" variant="outline" className="border-zinc-700 no-print" onClick={() => exportCsv(s)}>
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
              </div>
            </div>
            <DataTable testid={`tabela-${s}`} columns={COLS[s] || [{ key: "nome", label: "Item" }]} data={data[s]} />
          </div>
        ))}
      </div>
    </div>
  );
}
