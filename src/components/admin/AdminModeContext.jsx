import React, { createContext, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const Ctx = createContext({ isAdmin: false, adminView: false, setMode: () => {} });

// Tryb podglądu: "admin" (dodatki dla admina) albo "guest" (dokładnie jak gość).
export function AdminModeProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setModeState] = useState(() => localStorage.getItem("exm_view") || "admin");

  useEffect(() => {
    base44.auth.me().then((u) => setIsAdmin(u?.role === "admin")).catch(() => setIsAdmin(false));
  }, []);

  const setMode = (m) => {
    localStorage.setItem("exm_view", m);
    setModeState(m);
  };

  return (
    <Ctx.Provider value={{ isAdmin, mode, adminView: isAdmin && mode === "admin", setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAdminMode = () => useContext(Ctx);