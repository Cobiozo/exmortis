import React, { useRef } from "react";
import { cn } from "@/lib/utils";

// Przełącznik Podcast / Muzyka — dwie zakładki zamiast dwóch długich modułów jeden pod drugim.
// Klawiatura: strzałki w lewo/prawo, Home i End; aktywna zakładka ma złotą linię.
const TABS = [
  ["podcast", "Podcast"],
  ["muzyka", "Muzyka"],
];

export default function GlosTabs({ value, onChange }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    const i = TABS.findIndex(([k]) => k === value);
    let next = null;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(TABS[next][0]);
    refs.current[TABS[next][0]]?.focus();
  };

  return (
    <div role="tablist" aria-label="Głos: podcast i muzyka" onKeyDown={onKeyDown} className="flex gap-6 border-b border-exm-line">
      {TABS.map(([key, label]) => {
        const on = value === key;
        return (
          <button
            key={key}
            ref={(el) => { refs.current[key] = el; }}
            type="button"
            role="tab"
            id={`glos-tab-${key}`}
            aria-selected={on}
            aria-controls={`glos-panel-${key}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(key)}
            className={cn(
              "-mb-px border-b-2 px-1 pb-3 pt-1 font-exm-sans text-[15px] font-medium transition-colors",
              on ? "border-exm-gold text-exm-ivory" : "border-transparent text-exm-muted hover:text-exm-ivory"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}