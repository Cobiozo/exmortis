import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useViewer } from "@/lib/useViewer";
import { base44 } from "@/api/base44Client";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";

// Pełnoekranowa warstwa menu; Esc zamyka, blokada przewijania, fokus na pierwszej pozycji.
export default function MobileMenu({ open, onClose, top }) {
  const { user } = useViewer();
  const { pathname } = useLocation();
  const ref = useRef(null);
  const { menu: NAV, test: TEST } = useSiteNav();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("a,button")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  const item = (to) => `relic-heading text-[22px] whitespace-nowrap pb-1 border-b ${isActive(pathname, to) ? "gold-text border-[#C9A24A]" : "text-foreground/85 border-transparent"}`;
  const small = "technical text-xs text-foreground/70 hover:gold-text";

  return (
    <div id="mobile-menu" ref={ref} style={{ top }} className="fixed inset-x-0 bottom-0 z-40 bg-[#0A0A0B] overflow-y-auto animate-in fade-in duration-200 motion-reduce:animate-none">
      <nav aria-label="Menu główne" className="min-h-full flex flex-col items-center justify-center gap-7 py-10">
        {[...NAV, TEST].map((n) => <Link key={n.to} to={n.to} onClick={onClose} className={item(n.to)}>{n.label}</Link>)}
        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t hairline">
          <Link to="/kontakt" onClick={onClose} className={small}>Kontakt</Link>
          {user ? <Link to="/konto" onClick={onClose} className={small}>Moje konto</Link> : <Link to="/login" onClick={onClose} className={small}>Zaloguj</Link>}
          {user?.role === "admin" && <Link to="/admin" onClick={onClose} className={small}>Panel</Link>}
          {user && <button onClick={() => base44.auth.logout("/")} className={small}>Wyloguj</button>}
        </div>
      </nav>
    </div>
  );
}