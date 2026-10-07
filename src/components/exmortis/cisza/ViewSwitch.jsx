import React from "react";
import { VIEWS } from "./views";

// Przełącznik segmentowy: Cyfry i pasek · Same cyfry · Sam pasek.
export default function ViewSwitch({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Widok" className="inline-flex max-w-full border border-[#C9A24A]/40">
      {VIEWS.map((v) => {
        const on = value === v.id;
        return (
          <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(v.id)}
            className={`px-3 py-2 text-xs sm:text-sm whitespace-nowrap transition-colors ${on ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-[#F5EFE1]/70 hover:text-[#C9A24A]"}`}>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}