import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, Gem, Headphones, Mail, MessageSquare, Timer, UserRound, Circle } from "lucide-react";
import { useViewer } from "@/lib/useViewer";
import { base44 } from "@/api/base44Client";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";
import useDialogA11y from "@/lib/useDialogA11y";

// Menu rozwijane spod przycisku ☰ (telefon, tablet, wąskie okno). Od 17.11.2026 wygląd jak menu Mojego konta: karta z grupami
// („Poznaj” i „Bezpłatnie”), ikony, aktywna pozycja na złotym tle; na dole „Zrób test” i konto.
// Esc zamyka, blokada przewijania, fokus na pierwszej pozycji.
const ICONS = [["/o-mnie", UserRound], ["/powrot", MessageSquare], ["/skarbiec", Gem], ["/spotkania", CalendarDays],
  ["/glos", Headphones], ["/kontakt", Mail], ["/zacznij", ArrowRight], ["/cisza", Timer]];
// Prawa krawędź menu = prawa krawędź belki (kontener 1400 px, margines 20 / 40 px).
const edge = () => {
  const w = typeof window === "undefined" ? 1400 : window.innerWidth;
  return Math.max(12, (w - Math.min(w, 1400)) / 2 + (w >= 768 ? 40 : 20));
};
const iconFor = (to) => (ICONS.find(([p]) => String(to).startsWith(p)) || [null, Circle])[1];

export default function MobileMenu({ open, onClose, top, preview }) {
  const { user } = useViewer();
  const { pathname } = useLocation();
  const ref = useRef(null);
  const { menu: NAV, test: TEST } = useSiteNav();

  // Kliknięcie poza menu zamyka je (menu rozwija się tuż pod przyciskiem ☰, nie na cały ekran).
  useEffect(() => {
    if (!open || preview) return undefined;
    const out = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[aria-controls="mobile-menu"]')) onClose(); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open, preview, onClose]);
  // Bez pułapki Tab: przycisk „Zamknij menu” jest w nagłówku, poza tą warstwą.
  useDialogA11y(open && !preview, ref, onClose, { trap: false });

  // Blokada przewijania tła, gdy menu jest otwarte.
  useEffect(() => {
    if (!open || preview) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, preview]);

  if (!open) return null;
  const groups = [["Poznaj", NAV.filter((n) => n.desktop !== false)], ["Bezpłatnie", NAV.filter((n) => n.desktop === false)]].filter(([, l]) => l.length);
  const item = (on) => `flex items-center gap-3 min-h-[44px] px-3 rounded-lg text-[15px] transition-colors ${on ? "bg-[#C9A24A]/[0.12] text-[#F5EFE1]" : "text-[#F5EFE1]/80 hover:text-[#F5EFE1] hover:bg-white/[0.04]"}`;
  const btn = "flex items-center justify-center min-h-[46px] rounded-[10px] text-[14px]";
  const small = "text-sm text-[#F5EFE1]/65 hover:text-[#C9A24A] min-h-11 inline-flex items-center";

  return (
    <div id="mobile-menu" ref={ref} style={preview ? undefined : { top: top + 8, right: edge(), maxHeight: `calc(100dvh - ${top + 20}px)` }}
      className={`${preview ? "relative" : "fixed z-50"} w-[min(340px,calc(100vw-24px))] overflow-y-auto rounded-2xl border hairline bg-[#0F0F11] shadow-[0_20px_50px_rgba(0,0,0,.6)] animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none`}>
      <div className="flex flex-col p-2.5">
        <nav aria-label="Menu główne">
          {groups.map(([name, list], g) => (
            <div key={name} className={g ? "mt-3 pt-3 border-t hairline" : ""}>
              <p className="technical text-[10px] text-[#F5EFE1]/60 px-3 pt-1.5 mb-1.5">{name.toUpperCase()}</p>
              <ul className="space-y-0.5">
                {list.map((n) => {
                  const on = isActive(pathname, n.to);
                  const Icon = iconFor(n.to);
                  return (
                    <li key={n.to}>
                      <Link to={n.to} onClick={onClose} aria-current={on ? "page" : undefined} className={item(on)}>
                        <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[#C9A24A]" : "text-[#F5EFE1]/50"}`} aria-hidden="true" />
                        <span className="flex-1">{n.label}</span>
                        {n.sub && <span className="text-xs text-[#F5EFE1]/50">{n.sub}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-2 pt-3 border-t hairline grid grid-cols-2 gap-2 px-1 pb-1">
          {/* 19.11.2026: wyróżnione konto (jak w belce), „Zrób test” jako zwykły przycisk. */}
          <Link to={TEST.to} onClick={onClose} className={`${btn} border border-white/15 text-[#F5EFE1] hover:border-[#C9A24A]/60`}>{TEST.label}</Link>
          {user
            ? <Link to="/konto" onClick={onClose} className={`${btn} bg-[#C9A24A] text-[#0A0A0B] font-semibold hover:bg-[#E2C27A]`}>Moje konto</Link>
            : <Link to="/login" onClick={onClose} className={`${btn} bg-[#C9A24A] text-[#0A0A0B] font-semibold hover:bg-[#E2C27A]`}>Zaloguj się</Link>}
        </div>
        {user && (
          <div className="flex justify-center gap-6 mt-2">
            {user.role === "admin" && <Link to="/admin" onClick={onClose} className={small}>Panel</Link>}
            <button type="button" onClick={() => base44.auth.logout("/")} className={small}>Wyloguj się</button>
          </div>
        )}
      </div>
    </div>
  );
}