import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Star, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sourceOf, statusOf } from "@/components/exmortis/glos/musicUtils";
import SongForm from "./SongForm";
import SourceBadge from "./SourceBadge";

const U = base44.entities.Utwor;
const ST = { szkic: "Szkic", opublikowany: "Opublikowany", ukryty: "Ukryty" };

// Utwory na /glos (zakładka Muzyka): własne audio i/lub YouTube, okładka, autor, tekst, kategoria, kolejność,
// wyróżnienie, status. Publicznie widać tylko opublikowane — szkice i ukryte nie są dostępne dla gości.
export default function SongsTab() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null); // null | "new" | rekord
  const load = () => U.filter({}, { sort: "kolejnosc", limit: 200 }).then((r) => setRows(r.items || []));
  useEffect(() => { load(); }, []);

  const move = async (i, d) => {
    const a = rows[i], b = rows[i + d];
    if (!b) return;
    const ka = a.kolejnosc ?? i, kb = b.kolejnosc ?? i + d;
    await U.bulkUpdate([{ id: a.id, kolejnosc: kb === ka ? ka + d : kb }, { id: b.id, kolejnosc: ka }]);
    load();
  };
  const del = async (r) => { if (window.confirm(`Usunąć utwór „${r.tytul}”?`)) { await U.delete(r.id); load(); } };
  const done = () => { setEdit(null); load(); };

  if (!rows) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  const next = rows.reduce((m, r) => Math.max(m, Number(r.kolejnosc) || 0), 0) + 1;

  return (
    <div className="space-y-4">
      {edit ? (
        <SongForm song={edit === "new" ? null : edit} nextOrder={next} onDone={done} onCancel={() => setEdit(null)} />
      ) : (
        <button onClick={() => setEdit("new")} className="btn-relic !py-2 !px-5">Dodaj utwór</button>
      )}
      {!rows.length && <p className="text-sm text-foreground/45">Brak utworów.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className="border hairline p-3 flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Wyżej" className="text-foreground/50 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Niżej" className="text-foreground/50 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
            {r.okladka && <img src={r.okladka} alt="" className="h-10 w-10 object-cover rounded" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{r.wyrozniony && <Star className="inline h-3.5 w-3.5 gold-text mr-1" aria-label="Wyróżniony" />}{r.tytul}</p>
              <p className="text-xs text-foreground/50">{[r.autor || "EXMORTIS", r.kategoria, ST[statusOf(r)]].filter(Boolean).join(" · ")}</p>
            </div>
            <SourceBadge src={sourceOf(r)} />
            <button onClick={() => setEdit(r)} aria-label="Edytuj" className="text-foreground/60 hover:text-[#C9A24A]"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => del(r)} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}