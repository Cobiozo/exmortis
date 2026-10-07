import React from "react";
import { Check } from "lucide-react";
import { STEPS } from "./eventForm";

// Wskaźnik kroków: na telefonie „Krok 2 z 4 · Okładka”, od tabletu pełna lista; kroki klikalne po wypełnieniu.
export default function Stepper({ step, done, onGo }) {
  return (
    <nav aria-label="Kroki formularza">
      <p className="sm:hidden technical text-[10px] gold-text" aria-live="polite">Krok {step + 1} z {STEPS.length} · {STEPS[step]}</p>
      <div className="sm:hidden h-1 bg-[#1A1A1A] mt-2"><div className="h-full bg-[#C9A24A]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      <ol className="hidden sm:flex gap-2">
        {STEPS.map((s, i) => {
          const can = i <= step || done.slice(0, i).every(Boolean);
          return (
            <li key={s} className="flex-1 min-w-0">
              <button type="button" disabled={!can} onClick={() => onGo(i)} aria-current={i === step ? "step" : undefined}
                className={`w-full text-left border-t-2 pt-2 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60 disabled:opacity-40 ${i === step ? "border-[#C9A24A]" : done[i] ? "border-[#C9A24A]/50" : "border-[#2A2A2A]"}`}>
                <span className="technical text-[9px] text-foreground/45 flex items-center gap-1">{done[i] && i !== step ? <Check className="h-3 w-3 gold-text" /> : null}KROK {i + 1}</span>
                <span className={`block text-sm truncate ${i === step ? "gold-text" : "text-foreground/70"}`}>{s}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}