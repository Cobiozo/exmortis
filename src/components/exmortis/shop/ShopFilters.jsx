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

const LABELS = { stage: "ETAP", form: "FORMA", audience: "DLA KOGO" };

// Pasek filtrów Skarbca: zwinięty pod „Dopasuj materiały”; aktywne filtry widać zawsze (z ×).
// Dostępność wybiera się zakładkami nad katalogiem, dlatego tu jej nie ma.
export default function ShopFilters({ filters, setFilters, available, extra = null }) {
  const [open, setOpen] = useState(false);
  const a = available || { stages: STAGES, forms: FORM_OPTIONS, audiences: AUDIENCE_OPTIONS };
  const active = Object.keys(LABELS).filter((k) => filters[k]);
  const hasAny = active.length > 0;
  const toggle = (key) => (v) => setFilters((f) => ({ ...f, [key]: f[key] === v ? null : v }));
  const clear = () => setFilters((f) => ({ ...f, stage: null, form: null, audience: null }));

  return (
    <div className="sticky top-20 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="py-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`technical text-[10px] px-3 py-2.5 min-h-11 border flex items-center gap-2 transition-colors ${open || hasAny ? "border-[#C9A24A]/60 gold-text" : "hairline text-foreground/60 hover:text-foreground"}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> DOPASUJ MATERIAŁY{hasAny ? ` (${active.length})` : ""}
          </button>
          {active.map((k) => (
            <button key={k} onClick={() => setFilters((f) => ({ ...f, [k]: null }))}
              className="technical text-[9px] px-3 py-1.5 min-h-11 border border-[#C9A24A] gold-text bg-[#C9A24A]/10 flex items-center gap-1.5"
              aria-label={`Usuń filtr ${LABELS[k].toLowerCase()}: ${filters[k]}`}>
              {LABELS[k]}: {String(filters[k]).toUpperCase()} <X className="h-3 w-3" />
            </button>
          ))}
          {hasAny && (
            <button onClick={clear} className="technical text-[9px] px-2 min-h-11 text-foreground/55 hover:blood-text transition-colors">
              WYCZYŚĆ
            </button>
          )}
          {extra && <div className="ml-auto">{extra}</div>}
        </div>
        {open && (
          <div className="space-y-3 pb-5 pt-1 border-t hairline">
            <div className="pt-4" />
            <Group label="ETAP" options={a.stages} value={filters.stage} onToggle={toggle("stage")} allowAll />
            <Group label="FORMA" options={a.forms} value={filters.form} onToggle={toggle("form")} />
            <Group label="DLA KOGO" options={a.audiences} value={filters.audience} onToggle={toggle("audience")} />
          </div>
        )}
      </div>
    </div>
  );
}
