import React from "react";

// Proste słupki dzienne — bez nowych bibliotek, ten sam sposób co w statystykach Ciszy.
export default function FreeDailyBars({ series = [], range = 30 }) {
  const days = series.slice(-range);
  const max = Math.max(1, ...days.map((d) => d.n));
  const sum = days.reduce((s, d) => s + d.n, 0);
  return (
    <div className="border hairline p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="technical text-[9px] text-foreground/55">ZAMÓWIENIA DZIENNIE · {range} DNI</p>
        <p className="technical text-[10px] text-[#C9A24A]">{sum} razem</p>
      </div>
      <div className="flex items-end gap-[2px] h-[120px]" role="img" aria-label={`Darmowe materiały, ostatnie ${range} dni`}>
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.n}`}
            className="flex-1 min-w-[2px] bg-[#C9A24A]/55 hover:bg-[#C9A24A] transition-colors"
            style={{ height: d.n ? `${Math.max(4, (d.n / max) * 100)}%` : "2px" }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        <span className="technical text-[9px] text-foreground/40">{days[0]?.day?.slice(5)}</span>
        <span className="technical text-[9px] text-foreground/40">{days[days.length - 1]?.day?.slice(5)}</span>
      </div>
    </div>
  );
}