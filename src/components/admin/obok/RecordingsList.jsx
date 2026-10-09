import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import RecordingForm from "./RecordingForm";

// Nagrania serii: lista, dodawanie, edycja, kolejność.
export default function RecordingsList({ seria }) {
  const [recs, setRecs] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => base44.entities.ObokNagranie.filter({ seria_id: seria.id }, { sort: "numer", limit: 200 }).then((p) => setRecs(p.items));
  useEffect(() => { load(); }, [seria.id]);
  const add = async () => setEdit(await base44.entities.ObokNagranie.create({ seria_id: seria.id, numer: recs.length + 1, tytul: `Nagranie ${recs.length + 1}` }));
  const move = async (i, d) => {
    const a = recs[i], b = recs[i + d]; if (!b) return;
    await base44.entities.ObokNagranie.bulkUpdate([{ id: a.id, numer: b.numer }, { id: b.id, numer: a.numer }]); load();
  };
  if (edit) return <RecordingForm rec={edit} seria={seria} onClose={() => { setEdit(null); load(); }} />;
  return (
    <section>
      <div className="flex justify-between items-center mb-4"><p className="technical text-[10px] gold-text">NAGRANIA</p><button onClick={add} className="btn-ghost !py-2 !px-4">DODAJ NAGRANIE</button></div>
      <ul className="border-t hairline">
        {recs.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 py-3 border-b hairline text-sm">
            <span className="w-8 text-foreground/40">{r.numer}</span>
            <button onClick={() => setEdit(r)} className="flex-1 text-left text-[#F5EFE1] hover:gold-text">{r.tytul}</button>
            <span className={r.plik_uri ? "text-foreground/50" : "blood-text"}>{r.plik_uri ? r.format : "brak pliku"}</span>
            <span className="text-foreground/50">{r.status}</span>
            <button onClick={() => move(i, -1)} aria-label="Wyżej" className="px-2">↑</button><button onClick={() => move(i, 1)} aria-label="Niżej" className="px-2">↓</button>
          </li>
        ))}
      </ul>
    </section>
  );
}