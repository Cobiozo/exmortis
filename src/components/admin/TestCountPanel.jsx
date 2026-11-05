import React, { useEffect, useState } from "react";
import { testCounts, sumDays, RESULT_KEYS } from "@/lib/testCount";

const LABEL = {
  mentalna: "Śmierć mentalna",
  duchowa: "Śmierć duchowa",
  zyciowa: "Śmierć życiowa",
  wiele: "Więcej niż jedna",
  zadna: "Żadna nie dominuje",
};
const RANGES = [7, 30, 90, 365];

// Test „Która śmierć jest Twoja?” — anonimowy licznik ukończeń (od 5.11.2026).
// Tylko sumy dzienne w podziale na wynik; dawne wyniki sprzed 4.11 nie są tu pokazywane.
export default function TestCountPanel() {
  const [rows, setRows] = useState(null);
  const [range, setRange] = useState(30);

  useEffect(() => {
    testCounts().then(setRows).catch(() => setRows(false));
  }, []);

  if (rows === null) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }
  if (rows === false) return <p className="text-sm text-foreground/50">Nie udało się pobrać liczby ukończeń testu.</p>;

  const from = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10);
  const inRange = rows.filter((r) => String(r.day) >= from);
  const total = inRange.reduce((s, r) => s + (Number(r.n) || 0), 0);
  const byResult = RESULT_KEYS.map((k) => ({
    k, n: inRange.filter((r) => r.result === k).reduce((s, r) => s + (Number(r.n) || 0), 0),
  }));
  const days = {};
  inRange.forEach((r) => { days[r.day] = (days[r.day] || 0) + (Number(r.n) || 0); });
  const dayList = Object.entries(days).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="technical text-[11px] gold-text mb-2">TEST · UKOŃCZENIA</p>
          <p className="text-sm text-foreground/70">Ile razy ktoś doszedł do wyniku. Anonimowo — bez odpowiedzi i danych osób.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)}
              className={`technical text-[10px] px-3 py-2 border ${range === r ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/55 hover:text-foreground/80"}`}>
              {r} DNI
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <div className="border hairline p-6">
          <p className="technical text-[9px] text-foreground/40 mb-2">UKOŃCZENIA · {range} DNI</p>
          <p className="shop-heading text-4xl text-[#F5EFE1]">{total}</p>
        </div>
        <div className="border hairline p-6">
          <p className="technical text-[9px] text-foreground/40 mb-2">DZIŚ</p>
          <p className="shop-heading text-4xl text-[#F5EFE1]">{sumDays(rows, 1)}</p>
        </div>
        <div className="border hairline p-6">
          <p className="technical text-[9px] text-foreground/40 mb-2">OSTATNIE 7 DNI</p>
          <p className="shop-heading text-4xl text-[#C9A24A]">{sumDays(rows, 7)}</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-foreground/50">W tym okresie nikt jeszcze nie ukończył testu.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <p className="technical text-[9px] text-foreground/40 mb-3">WYNIKI</p>
            {byResult.map(({ k, n }) => (
              <div key={k} className="flex items-baseline justify-between border-b hairline py-2.5">
                <span className="text-sm text-foreground/70">{LABEL[k]}</span>
                <span className="technical text-[10px] text-[#F5EFE1]/70">
                  {n}<span className="text-foreground/35"> · {total ? Math.round((n / total) * 100) : 0}%</span>
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="technical text-[9px] text-foreground/40 mb-3">DNI (NAJNOWSZE 14 Z UKOŃCZENIAMI)</p>
            {dayList.map(([d, n]) => (
              <div key={d} className="flex items-baseline justify-between border-b hairline py-2.5">
                <span className="text-sm text-foreground/70">{d.split("-").reverse().join(".")}</span>
                <span className="technical text-[10px] text-[#F5EFE1]/70">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-foreground/50 mt-6">
        Liczone od 5.11.2026, raz na kartę przeglądarki (zmiana odpowiedzi nie dolicza kolejnego ukończenia).
        Rozpoczęć testu nie liczymy.
      </p>
    </div>
  );
}
