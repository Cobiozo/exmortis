import React from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { panelFor, hasEdit } from "@/components/admin/adminLinks";
import usePrelaunch, { hasEnd } from "@/lib/usePrelaunch";

const fmt = (d) => d.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
// Pasek admina (19.11.2026): ten sam system co belka i menu konta — Inter, zdania zamiast wersalików,
// zaokrąglone przyciski. Ciemnoczerwone tło zostaje jako znak trybu administratora.
const link = "inline-flex items-center min-h-8 px-2.5 rounded-md text-[#F5EFE1]/80 hover:text-[#F5EFE1] hover:bg-white/[0.06] transition-colors";
const seg = (on) => `inline-flex items-center min-h-7 px-3 text-[12px] font-medium transition-colors ${on ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-[#E2C170] hover:bg-[#C9A24A]/10"}`;
const ghost = "inline-flex items-center min-h-8 px-3 rounded-md border border-[#C9A24A]/50 text-[#E2C170] hover:border-[#C9A24A] hover:bg-[#C9A24A]/10 transition-colors";

// Pasek admina na stronie publicznej (40 px). W panelu się nie pokazuje.
export default function AdminBar() {
  const { isAdmin, guest, setMode } = useAdminMode();
  const { pathname } = useLocation();
  const { active, until } = usePrelaunch();
  if (!isAdmin || pathname.startsWith("/admin") || pathname === "/cisza") return null;
  const panel = sessionStorage.getItem("exm_panel") || "/admin";

  return (
    <>
      {guest && <div aria-hidden="true" className="fixed inset-0 z-[70] pointer-events-none border-2 border-[#C9A24A]" />}
      <div className="fixed top-0 inset-x-0 z-[60] h-10 bg-[#4A1517] border-b border-[#C9A24A]/20 text-[13px] text-[#F5EFE1]/85 flex items-center justify-between px-3 sm:px-4 gap-3 overflow-x-auto whitespace-nowrap">
        {guest ? (
          <>
            <span className="inline-flex items-center gap-2 text-[#E2C170]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24A]" aria-hidden="true" />
              Widok gościa{active ? " · przerwa techniczna" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setMode("admin")} className={ghost}>Wróć do widoku admina</button>
              <Link to={panel} onClick={() => setMode("admin")} className="inline-flex items-center min-h-8 px-3 rounded-md bg-[#C9A24A] font-medium text-[#0A0A0B] hover:bg-[#E2C170] transition-colors">Wróć do panelu</Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Link to="/admin" className={`${link} font-medium text-[#E2C170]`}>Panel exmortis</Link>
              {hasEdit(pathname) && <Link to={panelFor(pathname)} className={link}>Edytuj tę stronę</Link>}
              {active && <Link to="/admin/ustawienia" className={`${link} text-[#F5EFE1]`}>Przerwa techniczna{hasEnd(until) ? ` do ${fmt(until)}` : ""} — goście widzą stronę przerwy</Link>}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[12px] text-[#F5EFE1]/60">Widok:</span>
              <div className="flex overflow-hidden rounded-md border border-[#C9A24A]/50" role="group" aria-label="Widok strony">
                <button className={seg(true)} aria-pressed="true">Admin</button>
                <button onClick={() => setMode("guest")} className={seg(false)} aria-pressed="false">Gość</button>
              </div>
              <button onClick={() => base44.auth.logout("/")} className={link}>Wyloguj się</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
