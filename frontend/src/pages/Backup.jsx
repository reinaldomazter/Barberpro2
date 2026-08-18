import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HardDriveDownload, RotateCcw, FolderOpen } from "lucide-react";
import { api, apiError } from "@/api";
import { PageHeader } from "@/components/Layout";
import { DataTable, Field } from "@/components/CrudPage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Backup() {
  const [info, setInfo] = useState(null);
  const [pasta, setPasta] = useState("");
  const [auto, setAuto] = useState("0");
  const [restaurar, setRestaurar] = useState(null);

  const load = () => {
    api.get("/backup").then(({ data }) => { setInfo(data); setPasta(data.pasta); setAuto(data.automatico); })
      .catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => { load(); }, []);

  const fazerBackup = async () => {
    try {
      const { data } = await api.post("/backup", { pasta });
      toast.success(`Backup criado: ${data.arquivo}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const salvarPreferencias = async () => {
    try {
      await api.put("/configuracoes", { backup_pasta: pasta, backup_automatico: auto });
      toast.success("Preferências de backup salvas");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const confirmarRestauracao = async () => {
    try {
      await api.post("/backup/restaurar", { caminho: restaurar.caminho });
      toast.success("Backup restaurado. Recarregando…");
      setRestaurar(null);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="page-backup">
      <PageHeader title="Backup" subtitle="Cópia de segurança do banco SQLite local">
        <Button data-testid="fazer-backup" onClick={fazerBackup} className="bg-[#D4AF37] text-black hover:bg-[#B5952F] font-semibold">
          <HardDriveDownload className="h-4 w-4 mr-1" /> Fazer backup agora
        </Button>
      </PageHeader>

      <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4 grid sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <p className="label-xs mb-1">Banco de dados atual</p>
          <p className="mono text-sm break-all">{info?.banco}</p>
        </div>
        <Field field={{ name: "pasta", label: "Pasta de destino (pen drive, HD externo ou pasta local)" }} value={pasta} onChange={setPasta} />
        <Field field={{ name: "auto", label: "Backup automático (ao iniciar o dia)", type: "select", options: [{ value: "1", label: "Ativado" }, { value: "0", label: "Desativado" }] }}
          value={auto} onChange={setAuto} />
        <div>
          <Button data-testid="salvar-preferencias" variant="outline" className="border-zinc-700" onClick={salvarPreferencias}>
            <FolderOpen className="h-4 w-4 mr-1" /> Salvar preferências
          </Button>
        </div>
      </div>

      <h3 className="text-sm font-bold mb-2">Backups realizados</h3>
      <DataTable
        testid="backups-table"
        columns={[
          { key: "arquivo", label: "Arquivo" },
          { key: "data", label: "Data", render: (r) => new Date(r.data).toLocaleString("pt-BR") },
          { key: "tamanho", label: "Tamanho", render: (r) => `${(r.tamanho / 1024).toFixed(1)} KB` },
          { key: "tipo", label: "Tipo" },
          { key: "caminho", label: "Caminho" },
        ]}
        data={info?.backups || []}
        actions={(row) => (
          <Button data-testid={`restaurar-${row.id}`} size="sm" variant="ghost" className="hover:text-[#D4AF37]" onClick={() => setRestaurar(row)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar
          </Button>
        )}
      />

      <AlertDialog open={!!restaurar} onOpenChange={() => setRestaurar(null)}>
        <AlertDialogContent className="bg-[#18181B] border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar backup</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados atuais serão substituídos pelo conteúdo de "{restaurar?.arquivo}".
              Uma cópia de segurança dos dados atuais será criada automaticamente antes da restauração. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-restauracao" onClick={confirmarRestauracao} className="bg-red-600 hover:bg-red-700">
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
