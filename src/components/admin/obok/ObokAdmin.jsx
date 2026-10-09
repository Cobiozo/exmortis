import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SeriesForm from "./SeriesForm";
import RecordingsList from "./RecordingsList";
import Timeline from "./Timeline";
import Participants from "./Participants";

const TYP = { sekwencja: "Sekwencja", cotygodniowa: "Cotygodniowa", zbior: "Zbiór" };

// Panel Obok: lista serii → ekran serii (ustawienia, oś czasu, nagrania, uczestnicy).
export default function ObokAdmin() {
  const [list, setList] = useState(null);
  const [counts, setCounts] = useState({});
  const [sel, setSel] = useState(null);
  const load = async () => {
    const { items } = await base44.entities.ObokSeria.filter({}, { sort: "kolejnosc", limit: 100 });
    setList(items);
    const c = await base44.entities.ObokUczestnik.aggregate({ groupBy: "seria_id" });
    setCounts(Object.fromEntries((c.rows || []).map((r) => [r.seria_id, r.count])));
  };
  useEffect(() => { load(); }, []);
  const create = async () => { const s = await base44.entities.ObokSeria.create({ nazwa: "Nowa seria", slug: `seria-${Date.now().toString(36)}` }); await load(); setSel(s); };

  if (sel) return (
    <div className="space-y-12">
      <button onClick={() => { setSel(null); load(); }} className="technical text-[10px] gold-text">← WSZYSTKIE SERIE</button>
      <SeriesForm seria={sel} onSaved={setSel} />
      <Timeline seria={sel} />
      <RecordingsList seria={sel} />
      <Participants seria={sel} />
    </div>
  );
  if (!list) return <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>;
  return (
    <div>
      <div className="flex justify-between items-center mb-6"><p className="text-sm text-foreground/55">Obok — nagrania na drogę powrotu, dla osób z kontem.</p><button onClick={create} className="btn-relic">NOWA SERIA</button></div>
      <div className="table-scroll"><table className="w-full text-sm">
        <thead><tr className="text-left technical text-[10px] text-foreground/45"><th className="py-3">Nazwa</th><th>Typ</th><th>Uczestnicy</th><th>Edycja</th><th>Status</th></tr></thead>
        <tbody>{list.map((s) => (
          <tr key={s.id} onClick={() => setSel(s)} className="border-t hairline cursor-pointer hover:bg-[#121110]">
            <td className="py-4 text-[#F5EFE1]">{s.nazwa}</td><td>{TYP[s.typ]}</td><td>{counts[s.id] || 0}</td>
            <td>{s.edycja_start ? new Date(s.edycja_start).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }) : "—"}</td><td>{s.status}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}