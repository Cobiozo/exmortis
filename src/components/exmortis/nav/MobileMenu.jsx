import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, Gem, Headphones, Mail, MessageSquare, Timer, UserRound, Circle } from "lucide-react";
import { useViewer } from "@/lib/useViewer";
import { base44 } from "@/api/base44Client";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";
import useDialogA11y from "@/lib/useDialogA11y";

// Warstwa menu na telefonie i tablecie. Od 17.11.2026 wygląd jak menu Mojego konta: karta z grupami
// („Poznaj” i „Bezpłatnie”), ikony, aktywna pozycja na złotym tle; na dole „Zrób test” i konto.
// Esc zamyka, blokada przewijania, fokus na pierwszej pozycji.
const ICONS = [["/o-mnie", UserRound], ["/powrot", MessageSquare], ["/skarbiec", Gem], ["/spotkania", CalendarDays],
  ["/glos", Headphones], ["/kontakt", Mail], ["/zacznij", ArrowRight], ["/cisza", Timer]];
const iconFor = (to) => (ICONS.find(([p]) => String(to).startsWith(p)) || [null, Circle])[1];

export default function MobileMenu({ open, onClose, top, preview }) {
  const { user } = useViewer();
  const { pathname } = useLocation();
  const ref = useRef(null);
  const { menu: NAV, test: TEST } = useSiteNav();

  useEffect(() => {
    if (!open || preview) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open, preview]);
  // Bez pułapki Tab: przycisk „Zamknij menu” jest w nagłówku, poza tą warstwą.
  useDialogA11y(open && !preview, ref, onClose, { trap: false });

  if (!open) return null;
  const groups = [["Poznaj", NAV.filter((n) => n.desktop !== false)], ["Bezpłatnie", NAV.filter((n) => n.desktop === false)]].filter(([, l]) => l.length);
  const item = (on) => `flex items-center gap-3 min-h-[46px] px-3 rounded-lg text-[16px] transition-colors ${on ? "bg-[#C9A24A]/[0.12] text-[#F5EFE1]" : "text-[#F5EFE1]/80 hover:text-[#F5EFE1] hover:bg-white/[0.04]"}`;
  const btn = "flex items-center justify-center min-h-[50px] rounded-[10px] text-[15px]";
  const small = "text-sm text-[#F5EFE1]/65 hover:text-[#C9A24A] min-h-11 inline-flex items-center";

  return (
    <div id="mobile-menu" ref={ref} style={preview ? undefined : { top }} className={`${preview ? "relative h-full" : "fixed inset-x-0 bottom-0 z-40"} bg-[#0A0A0B] overflow-y-auto animate-in fade-in duration-200 motion-reduce:animate-none`}>
      <div className="min-h-full flex flex-col px-4 py-4 max-w-md mx-auto">
        <nav aria-label="Menu główne" className="rounded-2xl border hairline bg-[#0F0F11] p-2.5">
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

        <div className="mt-auto pt-6 grid grid-cols-2 gap-2.5">
          <Link to={TEST.to} onClick={onClose} className={`${btn} bg-[#C9A24A] text-[#0A0A0B] font-semibold hover:bg-[#E2C27A]`}>{TEST.label}</Link>
          {user
            ? <Link to="/konto" onClick={onClose} className={`${btn} border border-white/15 text-[#F5EFE1] hover:border-[#C9A24A]/60`}>Moje konto</Link>
            : <Link to="/login" onClick={onClose} className={`${btn} border border-white/15 text-[#F5EFE1] hover:border-[#C9A24A]/60`}>Zaloguj</Link>}
        </div>
        {user && (
          <div className="flex justify-center gap-6 mt-2">
            {user.role === "admin" && <Link to="/admin" onClick={onClose} className={small}>Panel</Link>}
            <button type="button" onClick={() => base44.auth.logout("/")} className={small}>Wyloguj</button>
          </div>
        )}
      </div>
    </div>
  );
}
