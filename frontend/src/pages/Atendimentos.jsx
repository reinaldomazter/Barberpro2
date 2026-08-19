import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, Printer } from "lucide-react";
import { api, apiError, money } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FORMAS = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Outros"];
const hoje = () => new Date().toISOString().slice(0, 10);

export default function Atendimentos() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [open, setOpen] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [barbeiroId, setBarbeiroId] = useState("");
  const [itens, setItens] = useState([]);
  const [desconto, setDesconto] = useState(0);
  const [forma, setForma] = useState("Dinheiro");
  const [obs, setObs] = useState("");

  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(hoje());
  const [recibo, setRecibo] = useState(null);
  const [conf, setConf] = useState({});

  const load = () => api.get("/atendimentos", { params: { inicio, fim } }).then(({ data }) => setLista(data));
  useEffect(() => { load(); }, [inicio, fim]);
  useEffect(() => {
    api.get("/clientes").then(({ data }) => setClientes(data));
    api.get("/barbeiros").then(({ data }) => setBarbeiros(data));
    api.get("/servicos").then(({ data }) => setServicos(data));
    api.get("/produtos").then(({ data }) => setProdutos(data));
    api.get("/configuracoes").then(({ data }) => setConf(data));
  }, []);

  useEffect(() => {
    if (!clienteId) return setSaldos([]);
    api.get("/clientes-pacotes", { params: { cliente_id: clienteId } }).then(({ data }) => {
      const s = [];
      data.filter((p) => p.status === "Ativo").forEach((p) =>
        p.saldos.forEach((x) => x.utilizados < x.total && s.push({ servico_id: x.servico_id, restantes: x.total - x.utilizados })));
      setSaldos(s);
    });
  }, [clienteId]);

  const reset = () => {
    setClienteId(""); setBarbeiroId(""); setItens([]); setDesconto(0); setForma("Dinheiro"); setObs("");
  };

  const addServico = (s) => {
    const saldo = saldos.find((x) => x.servico_id === s.id);
    setItens([...itens, {
      tipo: "servico", servico_id: s.id, descricao: s.nome, quantidade: 1,
      preco_unitario: s.preco, usou_pacote: 0, temSaldo: !!saldo,
    }]);
  };

  const addProduto = (p) => {
    setItens([...itens, {
      tipo: "produto", produto_id: p.id, descricao: p.nome, quantidade: 1,
      preco_unitario: p.preco, usou_pacote: 0,
    }]);
  };

  const subtotal = itens.reduce((a, i) => a + (i.usou_pacote ? 0 : i.quantidade * i.preco_unitario), 0);
  const total = Math.max(subtotal - Number(desconto || 0), 0);
  const barbeiro = barbeiros.find((b) => String(b.id) === String(barbeiroId));
  const comissaoPrev = itens.filter((i) => i.tipo === "servico").reduce((a, i) => {
    const sv = servicos.find((s) => s.id === i.servico_id);
    const perc = sv?.comissao || barbeiro?.comissao || 0;
    return a + (i.quantidade * i.preco_unitario * perc) / 100;
  }, 0);

  const finalizar = async () => {
    if (!barbeiroId) return toast.error("Selecione o barbeiro");
    if (itens.length === 0) return toast.error("Adicione ao menos um serviço ou produto");
    try {
      const { data } = await api.post("/atendimentos", {
        cliente_id: clienteId ? Number(clienteId) : null,
        barbeiro_id: Number(barbeiroId),
        itens: itens.map(({ temSaldo, ...i }) => i),
        pagamentos: total > 0 ? [{ forma, valor: total }] : [],
        desconto: Number(desconto || 0),
        observacoes: obs,
      });
      toast.success(`Atendimento finalizado — ${money(data.total)} · comissão ${money(data.comissao)}`);
      setRecibo({
        numero: data.id,
        data: new Date(),
        cliente: clientes.find((c) => String(c.id) === String(clienteId))?.nome || "Avulso",
        barbeiro: barbeiro?.nome || "",
        itens: itens.map((i) => ({ ...i })),
        subtotal, desconto: Number(desconto || 0), total: data.total, forma,
      });
      setOpen(false); reset(); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const imprimirRecibo = () => {
    const r = recibo;
    if (!r) return;
    const linhas = r.itens.map((i) => `
      <tr>
        <td>${i.descricao}${i.usou_pacote ? " <small>(pacote)</small>" : ""}</td>
        <td class="c">${i.quantidade}</td>
        <td class="r">${i.usou_pacote ? "—" : money(i.quantidade * i.preco_unitario)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Comprovante #${r.numero}</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
        body{width:78mm;margin:0 auto;padding:8px;color:#000;font-size:12px}
        h1{font-size:15px;margin:4px 0 0;text-align:center}
        .sub{text-align:center;font-size:10px;color:#444;margin:2px 0}
        img{display:block;margin:0 auto 4px;max-height:52px;max-width:52px;object-fit:contain}
        hr{border:none;border-top:1px dashed #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}
        td,th{padding:2px 0;font-size:11px;vertical-align:top}
        .c{text-align:center;width:28px}.r{text-align:right;width:70px}
        .tot{font-size:14px;font-weight:bold}
        .foot{text-align:center;font-size:10px;margin-top:10px}
      </style></head><body>
      ${conf.logo ? `<img src="${conf.logo}" alt="">` : ""}
      <h1>${conf.nome_barbearia || "Barbearia"}</h1>
      ${conf.cnpj ? `<p class="sub">CNPJ ${conf.cnpj}</p>` : ""}
      ${conf.endereco ? `<p class="sub">${conf.endereco}</p>` : ""}
      ${conf.telefone ? `<p class="sub">Tel ${conf.telefone}</p>` : ""}
      <hr>
      <p class="sub" style="text-align:left">
        <strong>Comprovante nº ${r.numero}</strong><br>
        ${r.data.toLocaleString("pt-BR")}<br>
        Cliente: ${r.cliente}<br>
        Barbeiro: ${r.barbeiro}
      </p>
      <hr>
      <table><thead><tr><th style="text-align:left">Item</th><th class="c">Qtd</th><th class="r">Valor</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <hr>
      <table>
        <tr><td>Subtotal</td><td class="r">${money(r.subtotal)}</td></tr>
        <tr><td>Desconto</td><td class="r">-${money(r.desconto)}</td></tr>
        <tr class="tot"><td>TOTAL</td><td class="r">${money(r.total)}</td></tr>
        <tr><td>Pagamento</td><td class="r">${r.forma}</td></tr>
      </table>
      <p class="foot">Obrigado pela preferência!<br>BarberPro — sistema de gestão</p>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    const w = window.open("", "_blank", "width=420,height=680");
    if (!w) return toast.error("Permita janelas pop-up para imprimir o comprovante");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div data-testid="page-atendimentos">
      <PageHeader title="Atendimentos" subtitle="Registro rápido de serviços, consumos e pagamento">
        <input type="date" data-testid="filtro-inicio" value={inicio} onChange={(e) => setInicio(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
        <input type="date" data-testid="filtro-fim" value={fim} onChange={(e) => setFim(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm" />
        <Button data-testid="new-button" onClick={() => { reset(); setOpen(true); }} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo atendimento
        </Button>
      </PageHeader>

      <DataTable
        testid="data-table"
        columns={[
          { key: "data", label: "Data", render: (r) => new Date(r.data).toLocaleString("pt-BR") },
          { key: "cliente", label: "Cliente", render: (r) => r.cliente || "Avulso" },
          { key: "barbeiro", label: "Barbeiro" },
          { key: "itens", label: "Itens", render: (r) => r.itens.map((i) => `${i.descricao}${i.usou_pacote ? " (pacote)" : ""}`).join(", ") },
          { key: "desconto", label: "Desconto", render: (r) => money(r.desconto) },
          { key: "total", label: "Total", render: (r) => <span className="mono text-[#D4AF37]">{money(r.total)}</span> },
          { key: "comissao", label: "Comissão", render: (r) => <span className="mono">{money(r.comissao)}</span> },
          { key: "pagamentos", label: "Pagamento", render: (r) => r.pagamentos.map((p) => p.forma).join(", ") || "—" },
        ]}
        data={lista}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="pos-dialog">
          <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field field={{ name: "cliente_id", label: "1. Cliente (opcional)", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) }}
                  value={clienteId} onChange={setClienteId} />
                <Field field={{ name: "barbeiro_id", label: "2. Barbeiro", type: "select", options: barbeiros.filter((b) => b.status === "Ativo").map((b) => ({ value: b.id, label: `${b.nome} (${b.comissao}%)` })) }}
                  value={barbeiroId} onChange={setBarbeiroId} />
              </div>

              <div>
                <p className="label-xs mb-2">3. Serviços</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {servicos.filter((s) => s.status === "Ativo").map((s) => (
                    <button key={s.id} data-testid={`servico-btn-${s.id}`} onClick={() => addServico(s)}
                      className="border border-zinc-700 rounded-md p-3 text-left hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors duration-200 active:scale-95">
                      <p className="text-sm font-semibold">{s.nome}</p>
                      <p className="mono text-sm text-[#D4AF37]">{money(s.preco)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-xs mb-2">4. Produtos / consumo</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {produtos.filter((p) => p.status === "Ativo").map((p) => (
                    <button key={p.id} data-testid={`produto-btn-${p.id}`} onClick={() => addProduto(p)}
                      className="border border-zinc-700 rounded-md p-2 text-left hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors duration-200 active:scale-95">
                      <p className="text-xs font-semibold">{p.nome}</p>
                      <p className="mono text-xs text-[#D4AF37]">{money(p.preco)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="label-xs">Resumo</p>
              <div className="border border-zinc-800 rounded-md divide-y divide-zinc-800" data-testid="carrinho">
                {itens.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum item</p>}
                {itens.map((i, idx) => (
                  <div key={idx} className="p-2.5 text-sm" data-testid={`carrinho-item-${idx}`}>
                    <div className="flex justify-between gap-2">
                      <span>{i.descricao}</span>
                      <div className="flex items-center gap-2">
                        <span className="mono">{i.usou_pacote ? "Pacote" : money(i.quantidade * i.preco_unitario)}</span>
                        <button onClick={() => setItens(itens.filter((_, x) => x !== idx))} className="text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" min="1" value={i.quantidade}
                        onChange={(e) => { const n = [...itens]; n[idx].quantidade = Number(e.target.value); setItens(n); }}
                        className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs" />
                      {i.temSaldo && (
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" data-testid={`usar-pacote-${idx}`} checked={!!i.usou_pacote}
                            onChange={(e) => { const n = [...itens]; n[idx].usou_pacote = e.target.checked ? 1 : 0; setItens(n); }} />
                          usar pacote
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Field field={{ name: "desconto", label: "5. Desconto (R$)", type: "number" }} value={desconto} onChange={setDesconto} />
              <Field field={{ name: "forma", label: "6. Forma de pagamento", type: "select", options: FORMAS }} value={forma} onChange={setForma} />
              <Field field={{ name: "obs", label: "Observações", type: "textarea" }} value={obs} onChange={setObs} />

              <div className="border border-zinc-800 rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="mono">{money(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="mono text-red-400">-{money(desconto)}</span></div>
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="mono text-[#D4AF37]" data-testid="total-atendimento">{money(total)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Comissão prevista</span><span className="mono">{money(comissaoPrev)}</span></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">Cancelar</Button>
            <Button data-testid="finalizar-button" onClick={finalizar} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-bold">
              <Check className="h-4 w-4 mr-1" /> 7. Finalizar atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recibo} onOpenChange={() => setRecibo(null)}>
        <DialogContent className="bg-[#18181B] border-zinc-800 max-w-sm" data-testid="recibo-dialog">
          <DialogHeader><DialogTitle>Comprovante nº {recibo?.numero}</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <div className="text-center">
              {conf.logo && <img src={conf.logo} alt="Logo" className="h-12 w-12 mx-auto object-contain rounded bg-zinc-900 mb-1" />}
              <p className="font-bold">{conf.nome_barbearia || "Barbearia"}</p>
              {conf.endereco && <p className="text-xs text-muted-foreground">{conf.endereco}</p>}
            </div>
            <div className="border-t border-dashed border-zinc-700 pt-2 text-xs text-muted-foreground">
              <p>{recibo?.data.toLocaleString("pt-BR")}</p>
              <p>Cliente: <span className="text-white">{recibo?.cliente}</span></p>
              <p>Barbeiro: <span className="text-white">{recibo?.barbeiro}</span></p>
            </div>
            <div className="border-t border-dashed border-zinc-700 pt-2 space-y-1">
              {recibo?.itens.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span>{i.quantidade}x {i.descricao}{i.usou_pacote ? " (pacote)" : ""}</span>
                  <span className="mono">{i.usou_pacote ? "—" : money(i.quantidade * i.preco_unitario)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-zinc-700 pt-2 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="mono">{money(recibo?.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="mono text-red-400">-{money(recibo?.desconto)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="mono text-[#D4AF37]">{money(recibo?.total)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pagamento</span><span>{recibo?.forma}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setRecibo(null)}>Fechar</Button>
            <Button data-testid="imprimir-recibo" onClick={imprimirRecibo} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
              <Printer className="h-4 w-4 mr-1" /> Imprimir comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
