import React from "react";
import { cn } from "@/lib/utils";

// Lista odpowiedzi jako duże przyciski-opcje: role=radio w radiogroup, złota ramka przy wyborze.
// Klawiatura: strzałki góra/dół i lewo/prawo przenoszą fokus między opcjami, Enter lub spacja wybiera.
// Strzałki nie zmieniają odpowiedzi — dzięki temu wybór nigdy nie przeskakuje na kolejne pytanie.
function moveFocus(e, index, count) {
  let next = null;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") next = index === count - 1 ? 0 : index + 1;
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = index === 0 ? count - 1 : index - 1;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = count - 1;
  if (next === null) return;
  e.preventDefault();
  const group = e.currentTarget.parentElement;
  if (!group) return;
  const items = group.querySelectorAll('[role="radio"]');
  items[next]?.focus();
}

export default function TestOptions({ label, options, value, onChange }) {
  const chosen = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="mt-6 space-y-3">
      {options.map((o, i) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (chosen < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => moveFocus(e, i, options.length)}
            className={cn(
              "flex w-full min-h-[56px] items-start gap-3 rounded-[var(--exm-r-field)] border px-4 py-3 text-left transition-colors",
              on ? "border-exm-gold bg-exm-bg" : "border-exm-line bg-exm-bg hover:border-exm-gold-line"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                on ? "border-exm-gold" : "border-exm-line-strong"
              )}
            >
              {on && <span className="h-2 w-2 rounded-full bg-exm-gold" />}
            </span>
            <span className={cn("text-[15px] leading-relaxed", on ? "text-exm-ivory" : "text-exm-text")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}