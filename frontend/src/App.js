import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Agendamentos from "@/pages/Agendamentos";
import Atendimentos from "@/pages/Atendimentos";
import Clientes from "@/pages/Clientes";
import Barbeiros from "@/pages/Barbeiros";
import Servicos from "@/pages/Servicos";
import Pacotes from "@/pages/Pacotes";
import Produtos from "@/pages/Produtos";
import Estoque from "@/pages/Estoque";
import Caixa from "@/pages/Caixa";
import Despesas from "@/pages/Despesas";
import Relatorios from "@/pages/Relatorios";
import Configuracoes from "@/pages/Configuracoes";
import Backup from "@/pages/Backup";

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.perfil !== "admin") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/agendamentos" element={<Protected><Agendamentos /></Protected>} />
          <Route path="/atendimentos" element={<Protected><Atendimentos /></Protected>} />
          <Route path="/clientes" element={<Protected><Clientes /></Protected>} />
          <Route path="/barbeiros" element={<Protected><Barbeiros /></Protected>} />
          <Route path="/servicos" element={<Protected><Servicos /></Protected>} />
          <Route path="/pacotes" element={<Protected><Pacotes /></Protected>} />
          <Route path="/produtos" element={<Protected><Produtos /></Protected>} />
          <Route path="/estoque" element={<Protected><Estoque /></Protected>} />
          <Route path="/caixa" element={<Protected><Caixa /></Protected>} />
          <Route path="/despesas" element={<Protected><Despesas /></Protected>} />
          <Route path="/relatorios" element={<Protected adminOnly><Relatorios /></Protected>} />
          <Route path="/configuracoes" element={<Protected adminOnly><Configuracoes /></Protected>} />
          <Route path="/backup" element={<Protected adminOnly><Backup /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
