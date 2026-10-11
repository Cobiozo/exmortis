import React from "react";
import { MODES, MODE_LABEL } from "./libApi";

// Przełącznik trzystanowy: Wyłączone / Tylko admin / Włączone.
export default function TriSwitch({ value, onChange, disabled }) {
  return (
    <div className="inline-flex border hairline">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`px-3 py-2 technical text-[10px] transition-colors disabled:opacity-40 ${
            value === m ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"
          }`}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}