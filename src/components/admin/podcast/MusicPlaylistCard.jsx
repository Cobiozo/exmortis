import React, { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Trash2, X } from "lucide-react";
import { inp } from "./podAdmin";

// Jedna playlista muzyczna: nazwa, opis, widoczność, utwory w kolejności (dodaj, przesuń, usuń).
// Zwinięta (27.11.2026): sam nagłówek — nazwa, liczba utworów, widoczność; po rozwinięciu opis i utwory.
export default function MusicPlaylistCard({ p, songs, open = true, onToggle, onSave, onDelete }) {
  const [nazwa, setNazwa] = useState(p.nazwa || "");
  const [opis, setOpis] = useState(p.opis || "");
  const ids = p.utwory || [];
  const title = (id) => songs.find((s) => s.id === id)?.tytul || "(usunięty utwór)";
  const free = songs.filter((s) => !ids.includes(s.id));
  const move = (i, d) => { const l = [...ids]; [l[i], l[i + d]] = [l[i + d], l[i]]; onSave({ utwory: l }); };

  return (
    <div className={`border hairline p-4 ${open ? "space-y-3" : ""}`}>
      <div className="flex items-center gap-3">
        <button onClick={onToggle} aria-expanded={open} aria-label={open ? "Zwiń playlistę" : "Rozwiń playlistę"} className="text-foreground/60 hover:gold-text">
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        <input value={nazwa} onChange={(e) => setNazwa(e.target.value)} onBlur={() => nazwa.trim() && nazwa !== p.nazwa && onSave({ nazwa: nazwa.trim() })} aria-label="Nazwa playlisty" className="bg-transparent shop-heading text-lg flex-1 min-w-0" />
        <button onClick={onToggle} className="text-xs text-foreground/50 whitespace-nowrap hover:text-foreground">{ids.length} {ids.length === 1 ? "utwór" : ids.length % 10 >= 2 && ids.length % 10 <= 4 && (ids.length % 100 < 12 || ids.length % 100 > 14) ? "utwory" : "utworów"}</button>
        <span className="text-xs text-foreground/50">{p.widoczna ? "Widoczna" : "Ukryta"}</span>
        <button onClick={() => onSave({ widoczna: !p.widoczna })} aria-label="Widoczność" className="text-foreground/50">{p.widoczna ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
        <button onClick={onDelete} aria-label="Usuń playlistę" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
      </div>
      {open && (<>
      <input value={opis} onChange={(e) => setOpis(e.target.value)} onBlur={() => opis !== (p.opis || "") && onSave({ opis })} placeholder="Krótki opis (opcjonalnie)" className={inp} />
      <ol className="space-y-1">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center gap-2 border hairline px-2 py-1.5 text-xs bg-[#0A0A0B]">
            <span className="w-5 text-foreground/40">{i + 1}.</span>
            <span className="flex-1 truncate">{title(id)}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Wyżej" className="disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label="Niżej" className="disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button onClick={() => onSave({ utwory: ids.filter((x) => x !== id) })} aria-label="Usuń z playlisty"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
        {!ids.length && <li className="text-xs text-foreground/45">Pusta playlista. Dodaj utwory poniżej.</li>}
      </ol>
      {free.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onSave({ utwory: [...ids, e.target.value] })} className="bg-black border hairline px-3 py-2 text-sm w-full sm:w-auto" aria-label="Dodaj utwór">
          <option value="">+ Dodaj utwór…</option>
          {free.map((s) => <option key={s.id} value={s.id}>{s.tytul}</option>)}
        </select>
      )}
      </>)}
    </div>
  );
}