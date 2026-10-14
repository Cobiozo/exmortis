import React from "react";
import BackdropThumb from "./BackdropThumb";

// Okrągłe miniatury teł + cichy link „Dopasuj dźwięk”.
export default function BackdropPicker({ items, value, onChange, match, onMatch }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-4" role="radiogroup" aria-label="Tło">
        {items.map((b) => {
          const sel = b.id === value;
          return (
            <button key={b.id} role="radio" aria-checked={sel} onClick={() => onChange(b.id)} className="flex flex-col items-center gap-2 w-16">
              <span className={`relative h-14 w-14 rounded-full overflow-hidden border transition-colors ${sel ? "border-[#C9A24A]" : "border-[#3D3D3F] hover:border-[#C9A24A]/60"}`}>
                <BackdropThumb bg={b} />
              </span>
              <span className={`text-[11px] max-w-full truncate ${sel ? "text-[#C9A24A]" : "text-foreground/55"}`}>{b.nazwa}</span>
            </button>
          );
        })}
      </div>
      {match && (
        <button onClick={onMatch} className="mt-3 text-xs text-foreground/55 hover:text-[#C9A24A] transition-colors">
          Dopasuj dźwięk: {match.nazwa}
        </button>
      )}
    </div>
  );
}