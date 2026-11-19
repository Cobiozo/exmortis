import React, { useRef } from "react";
import { Mic, Music } from "lucide-react";
import { cn } from "@/lib/utils";

// Przełącznik Podcast / Muzyka — dwie zakładki zamiast dwóch długich modułów jeden pod drugim.
// Klawiatura: strzałki w lewo/prawo, Home i End; aktywna zakładka ma złotą linię.
// 19.11.2026: dwa duże przyciski z ikoną i podpisem zamiast cienkich zakładek — od razu widać, że jest też muzyka.
const TABS = [
  ["podcast", "Podcast", "Rozmowy o drodze powrotu", Mic],
  ["muzyka", "Muzyka", "Utwory exmortis", Music],
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
    <div role="tablist" aria-label="Głos: podcast i muzyka" onKeyDown={onKeyDown} className="grid grid-cols-2 gap-3">
      {TABS.map(([key, label, sub, Icon]) => {
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
              "flex min-h-[64px] items-center gap-3 rounded-[var(--exm-r-card)] border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-exm-gold sm:px-5",
              on ? "border-exm-gold bg-[#C9A24A]/10" : "border-exm-line bg-exm-surface hover:border-exm-gold-line"
            )}
          >
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", on ? "border-exm-gold bg-exm-gold text-exm-bg" : "border-exm-line text-exm-gold")} aria-hidden="true">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className={cn("block font-exm-sans text-[16px] font-semibold", on ? "text-exm-ivory" : "text-exm-ivory/85")}>{label}</span>
              <span className="hidden text-[13px] text-exm-muted sm:block">{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}