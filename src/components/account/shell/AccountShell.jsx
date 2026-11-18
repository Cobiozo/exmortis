import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
import { GROUPS, hrefOf, labelOf, visibleSections } from "./accountNav";

// Oprawa panelu konta. Wygląd 16.11.2026: menu konta jako karta po lewej (od 1024 px),
// na telefonie i tablecie — przewijany pasek zakładek pod powitaniem (bez rozwijania „Zmień”).
// Sekcje, adresy (?tab=…) i kolejność bez zmian. Kolory marki: #0A0A0B, #F5EFE1, #C9A24A.
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exm-gold";
const ITEM = `flex items-center gap-3 min-h-[44px] px-3 rounded-[var(--exm-r-field)] text-[15px] transition-colors motion-reduce:transition-none ${FOCUS}`;
const ON = "bg-[#C9A24A]/[0.12] text-exm-ivory";
const OFF = "text-exm-text hover:text-exm-ivory hover:bg-white/[0.04]";

function NavList({ state, active, onPick }) {
  const items = visibleSections(state);
  return (
    <nav aria-label="Menu konta" className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-2.5">
      {GROUPS.map(([g, name]) => {
        const list = items.filter((s) => s.group === g);
        if (!list.length && g !== "konto") return null;
        return (
          <div key={g} className="mb-4 last:mb-0">
            <p className="technical text-[10px] text-exm-muted mb-1.5 px-3 pt-1.5">{name.toUpperCase()}</p>
            <ul className="space-y-0.5">
              {list.map((s) => {
                const Icon = s.icon;
                const on = s.key === active;
                return (
                  <li key={s.key}>
                    <Link to={hrefOf(s)} onClick={onPick} aria-current={on ? "page" : undefined} className={`${ITEM} ${on ? ON : OFF}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${on ? "text-exm-gold" : "text-exm-muted"}`} aria-hidden="true" />
                      <span className="flex-1">{s.label}</span>
                    </Link>
                  </li>
                );
              })}
              {g === "konto" && (
                <li className="pt-2 mt-2 border-t border-exm-line">
                  <button type="button" onClick={() => base44.auth.logout("/")} className={`${ITEM} ${OFF} w-full text-left`}>
                    <LogOut className="h-4 w-4 shrink-0 text-exm-muted" aria-hidden="true" />
                    <span>Wyloguj</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// Telefon/tablet: zakładki w jednym przewijanym rzędzie; aktywna przewija się do widoku.
function NavPills({ state, active, onPick }) {
  const items = visibleSections(state);
  const row = useRef(null);
  useEffect(() => {
    const el = row.current?.querySelector('[aria-current="page"]');
    if (el && row.current) row.current.scrollLeft = el.offsetLeft - 16;
  }, [active]);
  const pill = `shrink-0 inline-flex items-center min-h-[44px] px-4 rounded-[var(--exm-r-pill)] border text-sm whitespace-nowrap ${FOCUS}`;
  return (
    <nav aria-label="Menu konta" className="lg:hidden -mx-4 sm:-mx-5 md:-mx-10">
      <ul ref={row} className="flex gap-2 overflow-x-auto px-4 sm:px-5 md:px-10 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s) => {
          const on = s.key === active;
          return (
            <li key={s.key}>
              <Link to={hrefOf(s)} onClick={onPick} aria-current={on ? "page" : undefined}
                className={`${pill} ${on ? "bg-exm-gold border-exm-gold text-exm-bg font-semibold" : "border-exm-line-strong text-exm-text hover:border-exm-gold"}`}>
                {s.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => base44.auth.logout("/")} className={`${pill} border-exm-line text-exm-muted`}>Wyloguj</button>
        </li>
      </ul>
    </nav>
  );
}

export default function AccountShell({ state, active, aside, band, children }) {
  const { me } = state;
  const { pathname, search } = useLocation();
  const section = labelOf(active);

  // Po wyborze sekcji fokus przechodzi na nagłówek treści (czytniki ekranu), bez przewijania strony.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return undefined;
    picked.current = false;
    const t = setTimeout(() => {
      const h = document.querySelector("#tresc-konta h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }, 60);
    return () => clearTimeout(t);
  }, [pathname, search]);
  const onPick = () => { picked.current = true; };

  // Telefon/tablet: powitanie → zakładki → komunikaty → treść sekcji → Myśl na dziś.
  // Komputer: okruszki, powitanie z komunikatami po prawej, Myśl na dziś nad treścią, menu w karcie po lewej.
  return (
    <div className="bg-exm-bg pt-[76px] md:pt-24 lg:pt-28 pb-24 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-5 md:px-10">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-6 mb-5 lg:mb-7">
          <div className="min-w-0">
            <nav aria-label="Ścieżka" className="hidden lg:flex technical text-[10px] text-exm-muted mb-3 flex-wrap items-center gap-2">
              <Link to="/konto" className="hover:text-exm-ivory min-h-[32px] inline-flex items-center">MOJE KONTO</Link>
              {section && active !== "start" && <><span aria-hidden="true">/</span><span className="text-exm-gold">{section.toUpperCase()}</span></>}
            </nav>
            <p className="lg:hidden technical text-[11px] text-exm-gold mb-1.5">MOJE KONTO</p>
            {me ? (
              <h1 className="relic-heading text-[28px] leading-[1.2] md:text-4xl md:leading-tight">
                {`Dobrze, że jesteś${me.imie ? `, ${me.imie}` : ""}.`}
              </h1>
            ) : (
              <SkeletonBlock className="mt-2 h-9 w-56" />
            )}
          </div>
          <NavPills state={state} active={active} onPick={onPick} />
          {aside && <div className="w-full lg:max-w-[400px] flex flex-col gap-3 min-w-0 empty:hidden">{aside}</div>}
        </header>
        {band && <div className="hidden lg:block mb-8">{band}</div>}

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <NavList state={state} active={active} onPick={onPick} />
            </div>
          </aside>

          <div id="tresc-konta" className="min-w-0">{children}</div>
        </div>
        {band && <div className="lg:hidden mt-10">{band}</div>}
      </div>
    </div>
  );
}