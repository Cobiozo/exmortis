import React from "react";
import { gb2 } from "./libApi";

// Zajęta przestrzeń na pliki: pasek + ostrzeżenie od 80%.
export default function SpaceBar({ bytes, limitMb }) {
  const limit = Number(limitMb || 5120) * 1048576;
  const proc = limit ? Math.min(100, Math.round((Number(bytes || 0) / limit) * 100)) : 0;
  const high = proc >= 80;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="technical text-[10px] text-foreground/50">PRZESTRZEŃ NA PLIKI</p>
        <p className={`text-xs ${high ? "blood-text" : "text-foreground/60"}`}>
          {gb2(bytes)} GB z {gb2(limit)} GB ({proc}%)
        </p>
      </div>
      <div className="h-1.5 w-full bg-[#1A1A1B] border hairline">
        <div className={`h-full ${high ? "bg-[#BC1E22]" : "bg-[#C9A24A]"}`} style={{ width: `${proc}%` }} />
      </div>
      {high && <p className="text-xs blood-text">Zostało mniej niż 20% miejsca — rozważ zwiększenie progu w Ustawieniach.</p>}
    </div>
  );
}