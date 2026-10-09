import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Oś czasu odblokowań edycji (sekwencja).
export default function Timeline({ seria }) {
  const [recs, setRecs] = useState([]);
  useEffect(() => { base44.entities.ObokNagranie.filter({ seria_id: seria.id }, { sort: "numer", limit: 200 }).then((p) => setRecs(p.items)); }, [seria]);
  if (seria.typ !== "sekwencja" || !seria.edycja_start) return null;
  const step = seria.test_minuty > 0 ? seria.test_minuty * 60000 : 86400000;
  const start = Date.parse(seria.edycja_start);
  return (
    <section>
      <p className="technical text-[10px] gold-text mb-4">HARMONOGRAM EDYCJI</p>
      <ol className="border-l border-[#C9A24A]/50 pl-6 space-y-3">
        {recs.map((r, i) => (
          <li key={r.id} className="text-sm">
            <span className="text-[#F5EFE1]">{r.tytul}</span> — {new Date(start + i * step).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
            {(!r.plik_uri || r.status === "szkic") && <span className="blood-text"> · brak pliku lub szkic — nie otworzy się</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}