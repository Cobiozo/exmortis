import React from "react";

const pct = (v, prev) => (prev > 0 ? `${Math.round((v / prev) * 100)}%` : "—");

// Wiersze lejka: krok, liczba, % względem poprzedniego kroku.
export default function FunnelRows({ rows }) {
  return (
    <div className="border hairline overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_90px_90px] gap-4 px-5 py-3 technical text-[9px] text-foreground/55 border-b hairline">
        <span>KROK</span>
        <span className="text-right">LICZBA</span>
        <span className="text-right">% POPRZEDNIEGO</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_90px] gap-x-4 gap-y-1 px-5 py-4 border-b hairline last:border-b-0 items-baseline">
          <span className="text-sm text-foreground/75">
            <span className="technical text-[9px] text-foreground/50 mr-2">{String(i + 1).padStart(2, "0")}</span>
            {r.label}
          </span>
          <span className="text-right technical text-[11px] gold-text tabular-nums">
            {r.value === null ? "—" : r.value}
          </span>
          <span className="text-right technical text-[10px] text-foreground/55 tabular-nums col-span-2 sm:col-span-1">
            {r.value === null ? "—" : pct(r.value, rows[i - 1]?.value || 0)}
          </span>
          {r.note && <span className="col-span-2 sm:col-span-3 text-xs text-foreground/50">{r.note}</span>}
        </div>
      ))}
    </div>
  );
}