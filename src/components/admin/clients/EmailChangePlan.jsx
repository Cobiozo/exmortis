import React from "react";

// Tryb próbny: tabela → liczba rekordów, potem „Przenieś”.
export default function EmailChangePlan({ plan, busy, onTransfer }) {
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead><tr className="technical text-[10px] text-foreground/50 text-left"><th className="py-2">Baza</th><th>Tabela</th><th>Rekordy</th><th>Co się stanie</th></tr></thead>
        <tbody>{plan.map((p) => (
          <tr key={p.baza + p.zbior} className="border-t hairline"><td className="py-2">{p.baza}</td><td>{p.zbior}</td><td>{p.liczba}</td><td className="text-foreground/60">{p.akcja}</td></tr>
        ))}</tbody>
      </table>
      <p className="text-xs text-foreground/40">Przed przeniesieniem zapisuje się automatyczna kopia wszystkich danych tej osoby.</p>
      <button disabled={busy} onClick={onTransfer} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">{busy ? "PRZENOSZĘ…" : "PRZENIEŚ"}</button>
    </div>
  );
}