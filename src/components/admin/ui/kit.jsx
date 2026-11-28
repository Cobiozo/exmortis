import React from "react";
import { Search } from "lucide-react";

// Wspólne klocki modułów panelu (Etap 4, 28.11.2026) — jeden wygląd zakładek, filtrów, wyszukiwania,
// paska modułu, pustych stanów i ładowania. Moduły składają z nich swój układ.

// Zakładki widoku (np. Sprzedaż / Darmowe pobrania): podkreślenie, jak w całym panelu.
export function ViewTabs({ tabs, value, onChange, label = "Widok" }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b hairline overflow-x-auto">
      {tabs.map(([k, l, n]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`technical text-[10px] px-4 py-3 -mb-px border-b-2 whitespace-nowrap transition-colors ${
            value === k ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50 hover:text-foreground"
          }`}>
          {String(l).toUpperCase()}{n != null && <span className="ml-1.5 opacity-60">{n}</span>}
        </button>
      ))}
    </div>
  );
}

// Filtry listy (status, typ): kafelki, aktywny wypełniony złotem; opcjonalnie liczba.
export function FilterChips({ items, value, onChange, label = "Filtr" }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {items.map(([k, l, n]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`technical text-[10px] px-3.5 py-2 border transition-colors ${
            value === k ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline text-foreground/60 hover:text-foreground hover:border-foreground/30"
          }`}>
          {String(l).toUpperCase()}{n != null && <span className={`ml-1.5 ${value === k ? "opacity-70" : "opacity-50"}`}>{n}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Szukaj…", label, className = "" }) {
  return (
    <label className={`relative block min-w-[220px] ${className}`}>
      <span className="sr-only">{label || placeholder}</span>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" aria-hidden="true" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#0F0F10] border hairline pl-9 pr-3 py-2.5 text-sm placeholder:text-foreground/35 focus:outline-none focus:border-[#C9A24A]/60" />
    </label>
  );
}

// Pasek modułu: podsumowanie po lewej, przyciski po prawej (główny = btn-relic, pozostałe = btn-ghost).
export function ModuleBar({ summary, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="technical text-[10px] text-foreground/45">{summary}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// Pasek narzędzi nad listą: filtry, wyszukiwarka, przełączniki — zawija się na telefonie.
export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function Toggle({ checked, onChange, children, title }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer min-h-[40px]" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#C9A24A]" /> {children}
    </label>
  );
}

export function EmptyState({ children, action }) {
  return (
    <div className="border hairline px-6 py-10 text-center space-y-4">
      <p className="text-sm text-foreground/55 max-w-xl mx-auto">{children}</p>
      {action}
    </div>
  );
}

export function SkeletonList({ rows = 4, h = "h-16" }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Ładowanie">
      {[...Array(rows)].map((_, i) => <div key={i} className={`${h} border hairline bg-[#0F0F10] animate-pulse`} />)}
    </div>
  );
}

export function Notice({ children, tone = "gold" }) {
  const cls = tone === "error" ? "border-red-400/40 bg-red-500/10 text-red-300" : "border-[#C9A24A]/40 bg-[#C9A24A]/10 gold-text";
  return <p className={`text-xs border px-4 py-3 ${cls}`}>{children}</p>;
}
