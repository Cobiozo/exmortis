import React from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { panelFor, hasEdit } from "@/components/admin/adminLinks";

const pill = (on) => `min-h-[28px] px-3 technical text-[9px] border border-[#C9A24A]/50 ${on ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-[#C9A24A]"}`;

// Pasek admina na stronie publicznej (40 px). W panelu się nie pokazuje.
export default function AdminBar() {
  const { isAdmin, guest, setMode } = useAdminMode();
  const { pathname } = useLocation();
  if (!isAdmin || pathname.startsWith("/admin") || pathname === "/cisza") return null;
  const panel = sessionStorage.getItem("exm_panel") || "/admin";

  return (
    <>
      {guest && <div aria-hidden="true" className="fixed inset-0 z-[70] pointer-events-none border-2 border-[#C9A24A]" />}
      <div className="fixed top-0 inset-x-0 z-[60] h-10 bg-[#5C1A1B] text-[#C9A24A] flex items-center justify-between px-3 sm:px-4 gap-3 technical text-[9px] overflow-x-auto whitespace-nowrap">
        {guest ? (
          <>
            <span className="text-[#E2C170]">WIDOK GOŚCIA</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setMode("admin")} className={pill(false)}>WRÓĆ DO WIDOKU ADMINA</button>
              <Link to={panel} onClick={() => setMode("admin")} className={`${pill(true)} inline-flex items-center`}>WRÓĆ DO PANELU</Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="hover:text-[#E2C170]">EXMORTIS · PANEL</Link>
              {hasEdit(pathname) && <Link to={panelFor(pathname)} className="hover:text-[#E2C170]">EDYTUJ TĘ STRONĘ</Link>}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline">WIDOK:</span>
              <div className="flex"><button className={pill(true)}>ADMIN</button><button onClick={() => setMode("guest")} className={pill(false)}>GOŚĆ</button></div>
              <button onClick={() => base44.auth.logout("/")} className="hover:text-[#E2C170]">WYLOGUJ</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}