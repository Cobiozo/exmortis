import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { panelFor, siteFor } from "@/components/admin/adminLinks";

const Ctx = createContext({ isAdmin: false, adminView: false, guest: false, setMode: () => {} });
const KEY = "exm_view";

// Tryb podglądu dla admina: "admin" albo "guest". Trwa w karcie (sessionStorage), ?podglad=gosc działa tylko dla admina.
export function AdminModeProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(null); // null = jeszcze sprawdzamy
  const [mode, setModeState] = useState(() => {
    if (new URLSearchParams(window.location.search).get("podglad") === "gosc") return "guest";
    return sessionStorage.getItem(KEY) || "admin";
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((u) => setIsAdmin(u?.role === "admin")).catch(() => setIsAdmin(false));
  }, []);

  const setMode = (m) => { sessionStorage.setItem(KEY, m); setModeState(m); };
  const inPanel = location.pathname.startsWith("/admin");

  // Zapamiętaj ostatni ekran panelu — dla „Wróć do panelu”.
  useEffect(() => { if (inPanel) sessionStorage.setItem("exm_panel", location.pathname + location.search); }, [inPanel, location.pathname, location.search]);

  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") { e.preventDefault(); navigate(inPanel ? siteFor(location.pathname) : panelFor(location.pathname)); }
      if (k === "g") { e.preventDefault(); const next = mode === "guest" ? "admin" : "guest"; setMode(next); if (inPanel && next === "guest") navigate(siteFor(location.pathname)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, inPanel, mode, location.pathname, navigate]);

  const guest = isAdmin && mode === "guest";
  return (
    <Ctx.Provider value={{ isAdmin: !!isAdmin, ready: isAdmin !== null, mode, guest: !!guest, adminView: !!isAdmin && mode === "admin", setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAdminMode = () => useContext(Ctx);