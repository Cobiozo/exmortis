import React from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";

const pill = (on) =>
  `px-3 py-1 technical text-[9px] border border-[#C9A24A]/50 ${on ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-[#C9A24A]"}`;

export default function AdminBar() {
  const { isAdmin, mode, setMode } = useAdminMode();
  if (!isAdmin) return null;

  // Widok gościa: brak paska, tylko mały przycisk powrotu w rogu.
  if (mode === "guest") {
    return (
      <button
        onClick={() => setMode("admin")}
        className="fixed bottom-4 left-4 z-[60] px-3 py-1 technical text-[9px] bg-[#5C1A1B] text-[#C9A24A] opacity-60 hover:opacity-100"
      >
        WIDOK ADMINA
      </button>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-8 bg-[#5C1A1B] text-[#C9A24A] flex items-center justify-between px-4 gap-3">
      <span className="technical text-[9px] hidden sm:inline">JESTEŚ ZALOGOWANY JAKO ADMIN</span>
      <div className="flex items-center gap-1">
        <button onClick={() => setMode("guest")} className={pill(false)}>WIDOK GOŚCIA</button>
        <button className={pill(true)}>WIDOK ADMINA</button>
      </div>
      <div className="flex items-center gap-4 technical text-[9px]">
        <Link to="/admin" className="hover:text-[#E2C170]">PULPIT</Link>
        <button onClick={() => base44.auth.logout("/")} className="hover:text-[#E2C170]">WYLOGUJ</button>
      </div>
    </div>
  );
}