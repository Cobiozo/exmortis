import React, { useRef } from "react";
import { cn } from "@/lib/utils";

// Zakładki grup produktów: role tablist/tab, strzałki ← →, Home i End, jeden przystanek Tab.
// Pokazujemy wyłącznie grupy, które mają produkty (pusta zakładka nie istnieje).
// Użycie: <VaultTabs tabs={[{key,label,count}]} value={active} onChange={setActive} />
export default function VaultTabs({ tabs, value, onChange }) {
  const refs = useRef([]);

  const onKey = (e, i) => {
    const last = tabs.length - 1;
    const to =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
        : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
          : e.key === "Home" ? 0
            : e.key === "End" ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to].key);
    refs.current[to]?.focus();
  };

  return (
    <div role="tablist" aria-label="Grupy produktów" className="flex flex-wrap gap-2">
      {tabs.map((t, i) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`vault-tab-${t.key}`}
            aria-selected={active}
            aria-controls={`vault-panel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-[var(--exm-r-pill)] border px-4 text-[14px] transition-colors",
              active
                ? "border-exm-gold bg-exm-gold text-exm-bg"
                : "border-exm-line text-exm-muted hover:border-exm-gold-line hover:text-exm-ivory"
            )}
          >
            {t.label}
            <span className={cn("text-[12px] tabular-nums", active ? "opacity-70" : "opacity-60")}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}