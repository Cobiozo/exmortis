import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Dziennik: kto i kiedy otworzył, wyeksportował albo usunął dane osobowe.
export default function AccessLogList({ refresh }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    base44.entities.DataAccessLog.filter({}, { sort: "-created_date", limit: 50 }).then((p) => setRows(p.items));
  }, [refresh]);

  return (
    <div className="space-y-3">
      <p className="technical text-[10px] gold-text">DZIENNIK DOSTĘPU DO DANYCH (OSTATNIE 50)</p>
      {!rows ? <p className="text-foreground/40 text-sm">Ładowanie…</p> : rows.length === 0 ? <p className="text-foreground/40 text-sm">Brak wpisów.</p> : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead><tr className="technical text-[10px] text-foreground/50 text-left"><th className="py-2">Kiedy</th><th>Kto</th><th>Akcja</th><th>Zakres</th><th>Osoba</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t hairline"><td className="py-2 pr-3 whitespace-nowrap">{new Date(r.at || r.created_date).toLocaleString("pl-PL")}</td><td className="pr-3">{r.kto}</td><td className="pr-3">{r.akcja}</td><td className="pr-3">{r.zakres}{r.liczba ? ` (${r.liczba})` : ""}</td><td>{r.osoba || "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}