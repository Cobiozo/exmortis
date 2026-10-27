import React from "react";

// Rozmiar w jednostce, w której widać różnicę: drobne pliki w MB, duże w GB.
const size = (bytes) => {
  const b = Number(bytes || 0);
  return b < 1073741824 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1073741824).toFixed(2)} GB`;
};

// Zajęta przestrzeń na pliki: pasek + ostrzeżenie od 80%.
export default function SpaceBar({ bytes, limitMb }) {
  const limit = Number(limitMb || 5120) * 1048576;
  const proc = limit ? Math.min(100, (Number(bytes || 0) / limit) * 100) : 0;
  const high = proc >= 80;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="technical text-[10px] text-foreground/50">PRZESTRZEŃ NA PLIKI</p>
        <p className={`text-xs ${high ? "blood-text" : "text-foreground/60"}`}>
          {size(bytes)} z {size(limit)} ({proc > 0 && proc < 1 ? "<1%" : `${Math.round(proc)}%`})
        </p>
      </div>
      <div className="h-1.5 w-full bg-[#1A1A1B] border hairline">
        <div className={`h-full ${high ? "bg-[#BC1E22]" : "bg-[#C9A24A]"}`} style={{ width: `${proc}%` }} />
      </div>
      {high && <p className="text-xs blood-text">Zostało mniej niż 20% miejsca — rozważ zwiększenie progu w Ustawieniach.</p>}
    </div>
  );
}