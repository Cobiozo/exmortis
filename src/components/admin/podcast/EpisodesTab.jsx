import React, { useEffect, useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { EP, GU, PL, STATUS } from "./podAdmin";
import EpisodeForm from "./EpisodeForm";

export default function EpisodesTab() {
  const [eps, setEps] = useState(null);
  const [guests, setGuests] = useState([]);
  const [pls, setPls] = useState([]);
  const [edit, setEdit] = useState(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const load = () => {
    const query = { ...(status ? { status } : {}), ...(q.trim() ? { tytul: { $regex: q.trim(), $options: "i" } } : {}) };
    EP.filter(query, { sort: "-numer", limit: 100 }).then((p) => setEps(p.items));
  };
  useEffect(load, [status, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    GU.filter({}, { limit: 200 }).then((p) => setGuests(p.items));
    PL.filter({}, { limit: 100, fields: ["nazwa", "odcinki"] }).then((p) => setPls(p.items));
  }, []);

  const done = () => { setEdit(null); load(); };
  const dup = async (e) => {
    const { id, created_date, updated_date, created_by_id, ...d } = e;
    await EP.create({ ...d, tytul: `${e.tytul} (kopia)`, slug: `${e.slug}-kopia`, status: "szkic", odtworzenia: 0 });
    load();
  };
  const del = async (e) => { if (window.confirm(`Usunąć „${e.tytul}”?`)) { await EP.delete(e.id); load(); } };
  const nextNum = Math.max(0, ...(eps || []).map((e) => e.numer || 0)) + 1;

  if (!eps) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  if (edit) return <EpisodeForm ep={edit === "new" ? null : edit} guests={guests} nextNum={nextNum} onDone={done} onCancel={() => setEdit(null)} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setEdit("new")} className="btn-relic !py-3 !px-5">Nowy odcinek</button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black border hairline px-3 text-sm"><option value="">Wszystkie statusy</option>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj tytułu" className="bg-transparent border hairline px-3 text-sm" />
      </div>
      {!eps.length && <p className="text-sm text-foreground/45">Brak odcinków.</p>}
      {eps.map((e) => (
        <div key={e.id} className="border hairline p-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-mono gold-text w-10">#{e.numer ?? "—"}</span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-foreground">{e.tytul}</p>
            <p className="text-xs text-foreground/45">{[STATUS[e.status], e.publikacja && new Date(e.publikacja).toLocaleString("pl-PL"), e.gosc_nazwa, pls.filter((p) => p.odcinki?.includes(e.id)).map((p) => p.nazwa).join(", "), `${e.odtworzenia || 0} odtworzeń`].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={() => setEdit(e)} aria-label="Edytuj" className="p-1.5 text-foreground/50 hover:text-[#C9A24A]"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => dup(e)} aria-label="Duplikuj" className="p-1.5 text-foreground/50 hover:text-[#C9A24A]"><Copy className="h-4 w-4" /></button>
          <button onClick={() => del(e)} aria-label="Usuń" className="p-1.5 text-foreground/50 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}