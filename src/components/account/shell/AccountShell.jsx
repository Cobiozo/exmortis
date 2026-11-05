import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { GROUPS, SECTIONS, hrefOf, labelOf, visibleSections } from "./accountNav";

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
                      <span className="flex-1">{s.label}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-[#C9A24A]" aria-hidden="true" />}
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

export default function AccountShell({ state, active, aside, band, children }) {
  const { me } = state;
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const panelId = useId();
  const { pathname, search } = useLocation();
  const section = labelOf(active);

  // Po wyborze sekcji (zmiana adresu) menu na telefonie się zamyka, a fokus przechodzi na nagłówek sekcji.
  const picked = useRef(false);
  const wrap = useRef(null);
  useEffect(() => {
    setOpen(false);
    if (!picked.current) return;
    picked.current = false;
    const t = setTimeout(() => {
      const h = document.querySelector("#tresc-konta h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); h.scrollIntoView({ block: "nearest" }); }
    }, 60);
    return () => clearTimeout(t);
  }, [pathname, search]);
  // Escape zamyka menu i oddaje fokus przyciskowi; klik poza menu (np. menu serwisu) też je zamyka.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  const ActiveIcon = SECTIONS.find((s) => s.key === active)?.icon;

  // Telefon/tablet (< 1024 px): powitanie → menu konta → komunikaty → treść sekcji → Myśl na dziś.
  // Komputer: okruszki, powitanie z komunikatami po prawej, Myśl na dziś nad treścią, menu w kolumnie.
  return (
    <div className="bg-[#0A0A0B] pt-[76px] md:pt-24 lg:pt-28 pb-24 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-5 md:px-10">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-5 mb-5 lg:mb-6">
          <div className="min-w-0">
            <nav aria-label="Ścieżka" className="hidden lg:flex technical text-[10px] text-[#F5EFE1]/70 mb-3 flex-wrap items-center gap-2">
              <Link to="/konto" className="hover:text-[#F5EFE1] min-h-[32px] inline-flex items-center">MOJE KONTO</Link>
              {section && <><span aria-hidden="true">/</span><span className="gold-text">{section.toUpperCase()}</span></>}
            </nav>
            <p className="lg:hidden technical text-[11px] gold-text mb-1.5">MOJE KONTO</p>
            <h1 className="shop-heading text-[26px] leading-[1.25] md:text-4xl md:leading-tight text-[#F5EFE1]">
              {me ? `Dobrze, że jesteś${me.imie ? `, ${me.imie}` : ""}.` : "Twoje miejsce"}
            </h1>
          </div>
          {/* Telefon i tablet: jedno rozwijane menu konta z nazwą aktywnej sekcji. */}
          <div ref={wrap} className="lg:hidden">
            <button ref={btn} type="button" aria-expanded={open} aria-controls={panelId} aria-label={`Menu konta, aktywna sekcja: ${section || "brak"}`} onClick={() => setOpen((v) => !v)}
              className="w-full min-h-[48px] flex items-center gap-3 border hairline px-4 text-left text-base text-[#F5EFE1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
              {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0 gold-text" aria-hidden="true" />}
              <span className="flex-1 min-w-0 truncate">{section || "Wybierz sekcję"}</span>
              <span className="text-sm text-[#F5EFE1]/75" aria-hidden="true">Zmień</span>
              <ChevronDown className={`h-4 w-4 shrink-0 gold-text transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div id={panelId} hidden={!open} className="border hairline border-t-0 p-3 bg-[#0D0D0E]">
              <NavList state={state} active={active} onPick={() => { picked.current = true; setOpen(false); }} />
            </div>
          </div>

          {aside && <div className="w-full lg:max-w-[380px] flex flex-col gap-3 min-w-0 empty:hidden">{aside}</div>}
        </header>
        {band && <div className="hidden lg:block mb-8">{band}</div>}

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <NavList state={state} active={active} />
            </div>
          </aside>

          <div id="tresc-konta" className="min-w-0">{children}</div>
        </div>
        {band && <div className="lg:hidden mt-10">{band}</div>}
      </div>
    </div>
  );
}
