import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bp_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => localStorage.removeItem("bp_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (usuario, senha) => {
    const { data } = await api.post("/auth/login", { usuario, senha });
    localStorage.setItem("bp_token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("bp_token");
    setUser(null);
  };

  const isAdmin = user?.perfil === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
