import React, { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];
export const FORM_OPTIONS = ["Czytam", "Słucham", "Oglądam", "Uczestniczę", "Idę głęboko"];
export const AUDIENCE_OPTIONS = ["Mężczyzna", "Kobieta", "Ojciec", "Matka", "Mąż", "Żona", "Lider"];
export const AVAIL_OPTIONS = ["Dostępne", "Oczekujące"];

function Group({ label, options, value, onToggle, allowAll = false }) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span className="technical text-[9px] text-foreground/55 pt-2 w-[72px] flex-shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {allowAll && (
          <button
            onClick={() => onToggle(null)}
            className={`technical text-[9px] px-3 py-1.5 border transition-all duration-200 ${
              !value
                ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                : "hairline text-foreground/55 hover:text-foreground/70"
            }`}
          >
            WSZYSTKIE
          </button>
        )}
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`technical text-[9px] px-3 py-1.5 border transition-all duration-200 ${
              value === o
                ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                : "hairline text-foreground/55 hover:text-foreground/70"
            }`}
          >
            {o.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pasek filtrów Skarbca. Przyciski bez produktów są ukryte.
export default function ShopFilters({ filters, setFilters, available, extra = null }) {
  const [open, setOpen] = useState(false);
  const a = available || { stages: STAGES, forms: FORM_OPTIONS, audiences: AUDIENCE_OPTIONS };
  const hasAny = filters.stage || filters.form || filters.audience || filters.avail;
  const toggle = (key) => (v) => setFilters((f) => ({ ...f, [key]: f[key] === v ? null : v }));
  const clear = () => setFilters({ stage: null, form: null, audience: null, avail: null });

  const panel = (
    <div className="space-y-3 py-5">
      {(a.avail || []).length > 1 && <Group label="DOSTĘPNOŚĆ" options={a.avail} value={filters.avail} onToggle={toggle("avail")} />}
      <Group label="ETAP" options={a.stages} value={filters.stage} onToggle={toggle("stage")} allowAll />
      <Group label="FORMA" options={a.forms} value={filters.form} onToggle={toggle("form")} />
      <Group label="DLA KOGO" options={a.audiences} value={filters.audience} onToggle={toggle("audience")} />
      {hasAny && (
        <button
          onClick={clear}
          className="technical text-[9px] text-foreground/55 hover:blood-text flex items-center gap-1 pt-1 transition-colors"
        >
          <X className="h-3 w-3" /> WYCZYŚĆ FILTRY
        </button>
      )}
    </div>
  );

  return (
    <div className="sticky top-20 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="hidden md:flex items-start justify-between gap-6"><div className="flex-1 min-w-0">{panel}</div>{extra && <div className="pt-5 shrink-0">{extra}</div>}</div>
        <div className="md:hidden py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setOpen(!open)}
            className="technical text-[10px] px-3 py-2.5 border hairline text-foreground/60 flex items-center gap-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> FILTRUJ {hasAny && <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24A]" aria-label="filtry aktywne" />}
          </button>
          <div className="flex items-center gap-3">
            {hasAny && (
              <button onClick={clear} className="technical text-[9px] text-foreground/55 hover:blood-text transition-colors">
                WYCZYŚĆ
              </button>
            )}
            {extra}
          </div>
        </div>
        {open && <div className="md:hidden border-t hairline">{panel}</div>}
      </div>
    </div>
  );
}