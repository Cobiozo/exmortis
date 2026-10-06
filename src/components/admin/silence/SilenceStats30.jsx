import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Statystyki 30 dni: rozpoczęcia i ukończenia per czas i podkład (bez danych osobowych).
export default function SilenceStats30() {
  const [d, setD] = useState(null);
  useEffect(() => {
    base44.functions.invoke("silenceAdmin", { action: "stats30" }).then((r) => setD(r.data));
  }, []);

  return (
    <div className="border hairline p-6 bg-[#0F0F10]">
      <h3 className="relic-heading text-2xl mb-2">Statystyki · 30 dni</h3>
      {!d ? (
        <p className="text-sm text-foreground/50">Ładowanie…</p>
      ) : (
        <>
          <p className="text-sm text-foreground/60 mb-5">Sesje bez dźwięku: <span className="gold-text">{d.silent}</span></p>
          {d.rows.length === 0 ? (
            <p className="text-sm text-foreground/40">Brak sesji w ostatnich 30 dniach.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="technical text-[9px] text-foreground/40 text-left">
                <tr><th className="py-2">CZAS</th><th>PODKŁAD</th><th>ROZPOCZĘCIA</th><th>UKOŃCZENIA</th></tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="border-t hairline">
                    <td className="py-2">{r.duration_minutes} min</td>
                    <td className="text-foreground/70">{r.soundtrack}</td>
                    <td>{r.started}</td>
                    <td className="gold-text">{r.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}