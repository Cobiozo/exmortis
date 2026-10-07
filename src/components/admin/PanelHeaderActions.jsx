import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, ExternalLink, UserRound, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { siteFor } from "@/components/admin/adminLinks";

const btn = "inline-flex items-center gap-2 min-h-[44px] px-4 technical text-[10px] border hairline hover:border-[#C9A24A] hover:gold-text";

// Wyjścia z panelu: strona (w tej i nowej karcie), widok gościa, konto, wylogowanie.
export default function PanelHeaderActions() {
  const { setMode } = useAdminMode();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const site = siteFor(pathname);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to="/" onClick={() => setMode("admin")} className={btn}><Eye className="h-4 w-4" /> ZOBACZ STRONĘ</Link>
      <a href="/" target="_blank" rel="noopener" aria-label="Otwórz stronę w nowej karcie" className={`${btn} !px-3`}><ExternalLink className="h-4 w-4" /></a>
      <button onClick={() => { setMode("guest"); navigate(site); }} className={btn}>WIDOK GOŚCIA</button>
      <Link to="/konto" onClick={() => setMode("admin")} className={btn}><UserRound className="h-4 w-4" /> MOJE KONTO</Link>
      <button onClick={() => base44.auth.logout("/")} className={btn}><LogOut className="h-4 w-4" /> WYLOGUJ</button>
    </div>
  );
}