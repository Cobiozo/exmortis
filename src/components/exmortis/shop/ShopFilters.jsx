import React, { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];
const FORMS = ["Czytam", "Słucham", "Oglądam", "Uczestniczę", "Idę głęboko"];
const AUDIENCES = ["Mężczyzna", "Kobieta", "Ojciec", "Matka", "Mąż", "Żona", "Lider"];

function Group({ label, options, value, onToggle, allowAll = false }) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span className="technical text-[9px] text-foreground/30 pt-2 w-[72px] flex-shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {allowAll && (
          <button
            onClick={() => onToggle(null)}
            className={`technical text-[9px] px-3 py-1.5 border transition-all duration-200 ${
              !value
                ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                : "hairline text-foreground/40 hover:text-foreground/70"
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
                : "hairline text-foreground/40 hover:text-foreground/70"
            }`}
          >
            {o.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pasek filtrów Skarbca: na desktopie zawsze widoczny i przyklejony, na telefonie zwijany.
export default function ShopFilters({ filters, setFilters }) {
  const [open, setOpen] = useState(false);
  const hasAny = filters.stage || filters.form || filters.audience;
  const toggle = (key) => (v) => setFilters((f) => ({ ...f, [key]: f[key] === v ? null : v }));
  const clear = () => setFilters({ stage: null, form: null, audience: null });

  const panel = (
    <div className="space-y-3 py-5">
      <Group label="ETAP" options={STAGES} value={filters.stage} onToggle={toggle("stage")} allowAll />
      <Group label="FORMA" options={FORMS} value={filters.form} onToggle={toggle("form")} />
      <Group label="DLA KOGO" options={AUDIENCES} value={filters.audience} onToggle={toggle("audience")} />
      {hasAny && (
        <button
          onClick={clear}
          className="technical text-[9px] text-foreground/40 hover:blood-text flex items-center gap-1 pt-1 transition-colors"
        >
          <X className="h-3 w-3" /> WYCZYŚĆ FILTRY
        </button>
      )}
    </div>
  );

  return (
    <div className="sticky top-20 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="hidden md:block">{panel}</div>
        <div className="md:hidden py-3 flex items-center justify-between">
          <button
            onClick={() => setOpen(!open)}
            className="technical text-[10px] px-4 py-2.5 border hairline text-foreground/60 flex items-center gap-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> FILTRUJ {hasAny ? "· AKTYWNE" : ""}
          </button>
          {hasAny && (
            <button onClick={clear} className="technical text-[9px] text-foreground/40 hover:blood-text transition-colors">
              WYCZYŚĆ
            </button>
          )}
        </div>
        {open && <div className="md:hidden border-t hairline">{panel}</div>}
      </div>
    </div>
  );
}