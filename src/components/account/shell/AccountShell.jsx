import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { GROUPS, hrefOf, labelOf, visibleSections } from "./accountNav";

// Oprawa panelu konta (5.11.2026): nagłówek „Moje konto / sekcja”, menu konta w grupach
// (kolumna 220 px od 1024 px, niżej rozwijane „Menu konta: …”) i treść sekcji.
// Style tylko tutaj — strona publiczna bez zmian. Kolory marki: #0A0A0B, #F5EFE1, #C9A24A.
const ITEM = "flex items-center gap-3 min-h-[44px] px-3 text-base border-l-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#C9A24A] motion-reduce:transition-none";
const ON = "border-[#C9A24A] bg-[#C9A24A]/[0.10] text-[#F5EFE1]";
const OFF = "border-transparent text-[#F5EFE1]/75 hover:text-[#F5EFE1] hover:bg-white/[0.03]";

function NavList({ state, active, onPick }) {
  const items = visibleSections(state);
  return (
    <nav aria-label="Menu konta">
      {GROUPS.map(([g, name]) => {
        const list = items.filter((s) => s.group === g);
        if (!list.length && g !== "konto") return null;
        return (
          <div key={g} className="mb-6 last:mb-0">
            <p className="technical text-[10px] text-[#F5EFE1]/70 mb-2 px-3">{name.toUpperCase()}</p>
            <ul className="space-y-1">
              {list.map((s) => {
                const Icon = s.icon;
                const on = s.key === active;
                return (
                  <li key={s.key}>
                    <Link to={hrefOf(s)} onClick={onPick} aria-current={on ? "page" : undefined} className={`${ITEM} ${on ? ON : OFF}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[#C9A24A]" : "text-[#F5EFE1]/60"}`} aria-hidden="true" />
                      <span>{s.label}</span>
                    </Link>
                  </li>
                );
              })}
              {g === "konto" && (
                <li>
                  <button type="button" onClick={() => base44.auth.logout("/")} className={`${ITEM} ${OFF} w-full text-left`}>
                    <LogOut className="h-4 w-4 shrink-0 text-[#F5EFE1]/60" aria-hidden="true" />
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

export default function AccountShell({ state, active, aside, children }) {
  const { me } = state;
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const panelId = useId();
  const { pathname, search } = useLocation();
  const section = labelOf(active);

  // Po wyborze sekcji (zmiana adresu) menu na telefonie się zamyka.
  useEffect(() => { setOpen(false); }, [pathname, search]);
  // Escape zamyka menu i oddaje fokus przyciskowi.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="bg-[#0A0A0B] pt-24 md:pt-28 pb-24 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-5 md:px-10">
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-8">
          <div className="min-w-0">
            <nav aria-label="Ścieżka" className="technical text-[10px] text-[#F5EFE1]/70 mb-3 flex flex-wrap items-center gap-2">
              <Link to="/konto" className="hover:text-[#F5EFE1] min-h-[32px] inline-flex items-center">MOJE KONTO</Link>
              {section && <><span aria-hidden="true">/</span><span className="gold-text" aria-current="page">{section.toUpperCase()}</span></>}
            </nav>
            <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] leading-tight">
              {me ? `Dobrze, że jesteś${me.imie ? `, ${me.imie}` : ""}.` : "Twoje miejsce"}
            </h1>
          </div>
          {aside && <div className="w-full lg:max-w-[380px] flex flex-col gap-3 min-w-0">{aside}</div>}
        </header>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          {/* Telefon i tablet: jedno rozwijane menu konta z nazwą aktywnej sekcji. */}
          <div className="lg:hidden mb-6">
            <button ref={btn} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}
              className="w-full min-h-[48px] flex items-center justify-between gap-3 border hairline px-4 text-left text-base text-[#F5EFE1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
              <span><span className="technical text-[10px] text-[#F5EFE1]/70 mr-2">MENU KONTA:</span>{section || "wybierz sekcję"}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 gold-text transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div id={panelId} hidden={!open} className="border hairline border-t-0 p-3 bg-[#0D0D0E]">
              <NavList state={state} active={active} onPick={() => setOpen(false)} />
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <NavList state={state} active={active} />
            </div>
          </aside>

          <div id="tresc-konta" className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
