import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Scissors, Loader2 } from "lucide-react";
import { useAuth } from "@/auth";
import { api, apiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BG =
  "https://images.unsplash.com/photo-1759134198561-e2041049419c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxkYXJrJTIwbW9vZHklMjBiYXJiZXJzaG9wJTIwaW50ZXJpb3J8ZW58MHx8fHwxNzg3MDEyNjg2fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { user, login } = useAuth();
  const [usuario, setUsuario] = useState("admin");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [ident, setIdent] = useState({ nome_barbearia: "Barbearia Corte Certo", logo: "" });

  useEffect(() => {
    api.get("/publico/identidade").then(({ data }) => setIdent(data)).catch(() => {});
  }, []);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await login(usuario, senha);
    } catch (err) {
      setErro(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/75" />
      <form
        onSubmit={submit}
        data-testid="login-form"
        className="relative w-full max-w-sm bg-[#18181B]/95 border border-zinc-800 rounded-lg p-8 backdrop-blur"
      >
        <div className="flex items-center gap-2 mb-1">
          {ident.logo ? (
            <img src={ident.logo} alt="Logo" data-testid="login-logo" className="h-10 w-10 rounded object-contain bg-zinc-900" />
          ) : (
            <Scissors className="h-6 w-6 text-[#D4AF37]" />
          )}
          <h1 className="text-3xl font-extrabold">Barber<span className="text-[#D4AF37]">Pro</span></h1>
        </div>
        <p className="label-xs mb-8">Sistema de Gestão – {ident.nome_barbearia}</p>

        <div className="space-y-4">
          <div>
            <label className="label-xs block mb-1.5">Usuário</label>
            <Input
              data-testid="login-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="bg-zinc-900 border-zinc-700 focus-visible:ring-[#D4AF37]"
              autoFocus
            />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Senha</label>
            <Input
              data-testid="login-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="bg-zinc-900 border-zinc-700 focus-visible:ring-[#D4AF37]"
            />
          </div>
          {erro && <p data-testid="login-error" className="text-sm text-red-400">{erro}</p>}
          <Button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] text-black hover:bg-[#B5952F] font-bold active:scale-95 transition-transform"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </div>
        <p className="text-xs text-zinc-500 mt-6 text-center">
          Sistema 100% offline · dados locais em SQLite
        </p>
      </form>
    </div>
  );
}
