import React, { useMemo } from "react";
import { VIEWS } from "./views";
import { loopClock } from "./views/useFrame";

// Pięć okrągłych, żywych miniaturek widoków.
export default function ViewPicker({ value, onChange, reduced }) {
  const clock = useMemo(() => loopClock(9000), []);
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-5" role="radiogroup" aria-label="Widok odliczania">
      {VIEWS.map(({ id, label, C }) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          aria-label={`Widok: ${label}`}
          onClick={() => onChange(id)}
          className="group flex flex-col items-center gap-2"
        >
          <span
            className={`relative block h-14 w-14 rounded-full overflow-hidden border transition-colors duration-500 ${
              value === id ? "border-[#C9A24A]" : "border-[#F5EFE1]/10 group-hover:border-[#C9A24A]/40"
            }`}
          >
            <span className="absolute inset-[18%]">
              <C clock={clock} slow={reduced ? 1000 : 0} mini />
            </span>
          </span>
          <span className={`text-[11px] ${value === id ? "text-[#C9A24A]" : "text-foreground/50"}`}>{label}</span>
        </button>
      ))}
    </div>
  );
}