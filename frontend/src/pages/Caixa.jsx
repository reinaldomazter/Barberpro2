import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, ArrowDownUp } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Caixa() {
  const [atual, setAtual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [abrirOpen, setAbrirOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [valorInicial, setValorInicial] = useState(0);
  const [mov, setMov] = useState({ tipo: "Entrada", valor: 0, descricao: "" });
  const [informado, setInformado] = useState(0);

  const load = () => {
    api.get("/caixa/atual").then(({ data }) => setAtual(data)).catch((e) => toast.error(apiError(e)));
    api.get("/caixa").then(({ data }) => setHistorico(data));
  };
  useEffect(() => { load(); }, []);

  const abrir = async () => {
    try {
      await api.post("/caixa/abrir", { valor_inicial: Number(valorInicial) });
      toast.success("Caixa aberto"); setAbrirOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const registrarMov = async () => {
    if (!mov.valor) return toast.error("Informe o valor");
    try {
      await api.post("/caixa/movimentacao", { ...mov, valor: Number(mov.valor) });
      toast.success("Movimentação registrada"); setMovOpen(false); setMov({ tipo: "Entrada", valor: 0, descricao: "" }); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const fechar = async () => {
    try {
      const { data } = await api.post("/caixa/fechar", { total_informado: Number(informado) });
      toast.success(`Caixa fechado · diferença ${money(data.diferenca)}`);
      setFecharOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const aberto = atual?.caixa;

  return (
    <div data-testid="page-caixa">
      <PageHeader title="Caixa" subtitle="Abertura, movimentações e fechamento do dia">
        {!aberto ? (
          <Button data-testid="abrir-caixa" onClick={() => setAbrirOpen(true)} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
            <Unlock className="h-4 w-4 mr-1" /> Abrir caixa
          </Button>
        ) : (
          <>
            <Button data-testid="nova-movimentacao" variant="outline" className="border-zinc-700" onClick={() => setMovOpen(true)}>
              <ArrowDownUp className="h-4 w-4 mr-1" /> Movimentação
            </Button>
            <Button data-testid="fechar-caixa" onClick={() => { setInformado(atual.total_esperado.toFixed(2)); setFecharOpen(true); }}
              className="bg-red-600 hover:bg-red-700 font-semibold">
              <Lock className="h-4 w-4 mr-1" /> Fechar caixa
            </Button>
          </>
        )}
      </PageHeader>

      {!aberto ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center bg-[#18181B]" data-testid="caixa-fechado">
          <p className="text-muted-foreground">Nenhum caixa aberto. Abra o caixa para registrar atendimentos e movimentações.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="caixa-resumo">
            {[
              ["Aberto em", new Date(aberto.data_abertura).toLocaleString("pt-BR")],
              ["Responsável", aberto.usuario_abertura],
              ["Valor inicial", money(aberto.valor_inicial)],
              ["Total vendido", money(atual.total_vendido)],
              ["Dinheiro", money(atual.por_forma["Dinheiro"])],
              ["PIX", money(atual.por_forma["PIX"])],
              ["Débito", money(atual.por_forma["Cartão de Débito"])],
              ["Crédito", money(atual.por_forma["Cartão de Crédito"])],
              ["Outros", money(atual.por_forma["Outros"])],
              ["Comissões", money(atual.comissoes)],
              ["Saídas/Sangrias", money(atual.despesas)],
              ["Total esperado", money(atual.total_esperado)],
            ].map(([l, v]) => (
              <div key={l} className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
                <p className="label-xs mb-1">{l}</p>
                <p className="mono text-base font-bold">{v}</p>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-bold mt-6 mb-2">Movimentações do caixa</h3>
          <DataTable
            testid="movimentacoes-table"
            columns={[
              { key: "data", label: "Data", render: (r) => new Date(r.data).toLocaleString("pt-BR") },
              { key: "tipo", label: "Tipo" },
              { key: "descricao", label: "Descrição" },
              { key: "forma", label: "Forma" },
              { key: "valor", label: "Valor", render: (r) => <span className="mono">{money(r.valor)}</span> },
            ]}
            data={atual.movimentacoes}
          />
        </>
      )}

      <h3 className="text-sm font-bold mt-6 mb-2">Histórico de caixas</h3>
      <DataTable
        testid="historico-caixa"
        columns={[
          { key: "id", label: "#" },
          { key: "data_abertura", label: "Abertura", render: (r) => new Date(r.data_abertura).toLocaleString("pt-BR") },
          { key: "data_fechamento", label: "Fechamento", render: (r) => r.data_fechamento ? new Date(r.data_fechamento).toLocaleString("pt-BR") : "—" },
          { key: "valor_inicial", label: "Inicial", render: (r) => money(r.valor_inicial) },
          { key: "total_esperado", label: "Esperado", render: (r) => money(r.total_esperado) },
          { key: "total_informado", label: "Informado", render: (r) => money(r.total_informado) },
          { key: "diferenca", label: "Diferença", render: (r) => <span className={`mono ${r.diferenca < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(r.diferenca)}</span> },
          { key: "status", label: "Status" },
        ]}
        data={historico}
      />

      <Dialog open={abrirOpen} onOpenChange={setAbrirOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="abrir-dialog">
          <DialogHeader><DialogTitle>Abrir caixa</DialogTitle></DialogHeader>
          <Field field={{ name: "valor_inicial", label: "Valor inicial (R$)", type: "number" }} value={valorInicial} onChange={setValorInicial} />
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setAbrirOpen(false)}>Cancelar</Button>
            <Button data-testid="confirmar-abertura" onClick={abrir} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="mov-dialog">
          <DialogHeader><DialogTitle>Movimentação de caixa</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ name: "tipo", label: "Tipo", type: "select", options: ["Entrada", "Saída", "Sangria", "Reforço"] }}
              value={mov.tipo} onChange={(v) => setMov({ ...mov, tipo: v })} />
            <Field field={{ name: "valor", label: "Valor (R$)", type: "number" }} value={mov.valor} onChange={(v) => setMov({ ...mov, valor: v })} />
            <Field field={{ name: "descricao", label: "Descrição", full: true }} value={mov.descricao} onChange={(v) => setMov({ ...mov, descricao: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button data-testid="confirmar-movimentacao" onClick={registrarMov} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fecharOpen} onOpenChange={setFecharOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800" data-testid="fechar-dialog">
          <DialogHeader><DialogTitle>Fechamento de caixa</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {Object.entries(atual?.por_forma || {}).map(([f, v]) => (
              <div key={f} className="flex justify-between"><span className="text-muted-foreground">{f}</span><span className="mono">{money(v)}</span></div>
            ))}
            <div className="flex justify-between font-bold border-t border-zinc-800 pt-2">
              <span>Total esperado</span><span className="mono text-[#D4AF37]">{money(atual?.total_esperado)}</span>
            </div>
          </div>
          <Field field={{ name: "informado", label: "Total informado (R$)", type: "number" }} value={informado} onChange={setInformado} />
          <p className="text-xs text-muted-foreground">Após o fechamento o caixa não pode mais ser alterado.</p>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setFecharOpen(false)}>Cancelar</Button>
            <Button data-testid="confirmar-fechamento" onClick={fechar} className="bg-red-600 hover:bg-red-700 font-semibold">Fechar caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
