import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Headphones, Music, Pencil, Search, Star, Trash2 } from "lucide-react";
import useSongPlays from "./useSongPlays";
import { base44 } from "@/api/base44Client";
import { sourceOf, statusOf } from "@/components/exmortis/glos/musicUtils";
import SongForm from "./SongForm";
import SourceBadge from "./SourceBadge";
import { confirmDialog } from "@/components/admin/ui/confirmDialog";

const U = base44.entities.Utwor;
const ST = { szkic: "Szkic", opublikowany: "Opublikowany", ukryty: "Ukryty" };
const FILTERS = [["", "Wszystkie"], ["opublikowany", "Opublikowane"], ["szkic", "Szkice"], ["ukryty", "Ukryte"]];

// Utwory na /glos (zakładka Muzyka) — jedno miejsce zarządzania (27.11.2026): własne audio i/lub YouTube, okładka,
// autor, tekst, kategoria, kolejność, wyróżnienie, status. Publicznie widać tylko opublikowane.
// Wyszukiwarka i filtr statusu; ukrywanie i pokazywanie jednym kliknięciem; strzałki działają na pełnej liście.
export default function SongsTab() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null); // null | "new" | rekord
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [err, setErr] = useState("");
  const plays = useSongPlays();
  const load = () => U.filter({}, { sort: "kolejnosc", limit: 200 }).then((r) => setRows(r.items || []));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => (!st || statusOf(r) === st) && (!s || [r.tytul, r.autor, r.kategoria].some((x) => String(x || "").toLowerCase().includes(s))));
  }, [rows, q, st]);
  const filtered = !!(q.trim() || st);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, (rows || []).filter((r) => !k || statusOf(r) === k).length])), [rows]);

  const move = async (i, d) => {
    const a = rows[i], b = rows[i + d];
    if (!b) return;
    const ka = a.kolejnosc ?? i, kb = b.kolejnosc ?? i + d;
    await U.bulkUpdate([{ id: a.id, kolejnosc: kb === ka ? ka + d : kb }, { id: b.id, kolejnosc: ka }]);
    load();
  };
  // Pokaż / ukryj: opublikowany ↔ ukryty. Szkic bez audio i bez YouTube nie może być opublikowany.
  const toggle = async (r) => {
    setErr("");
    const pub = statusOf(r) === "opublikowany";
    if (!pub && sourceOf(r) === "brak") { setErr(`„${r.tytul}” nie ma pliku audio ani linku YouTube — dodaj źródło w edycji utworu.`); return; }
    const patch = pub ? { status: "ukryty", widoczny: false } : { status: "opublikowany", widoczny: true };
    setRows((l) => l.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    await U.update(r.id, patch).catch(() => load());
  };
  const del = async (r) => { if (await confirmDialog(`Usunąć utwór „${r.tytul}”? Tej operacji nie da się cofnąć.`)) { await U.delete(r.id); load(); } };
  const done = () => { setEdit(null); load(); };

  if (!rows) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  const orders = rows.map((r) => Number(r.kolejnosc) || 0);
  const next = (orders.length ? Math.max(...orders) : 0) + 1;
  const first = (orders.length ? Math.min(...orders) : 1) - 1;

  if (edit) return <SongForm song={edit === "new" ? null : edit} nextOrder={next} firstOrder={first} onDone={done} onCancel={() => setEdit(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button onClick={() => setEdit("new")} className="btn-relic !py-2 !px-5 self-start">Dodaj utwór</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, l]) => (
              <button key={k || "all"} onClick={() => setSt(k)}
                className={`technical text-[9px] px-3 py-2 border ${st === k ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10" : "hairline text-foreground/55 hover:text-foreground"}`}>
                {l.toUpperCase()} <span className="opacity-60">{counts[k]}</span>
              </button>
            ))}
          </div>
          <label className="relative block sm:w-60">
            <span className="sr-only">Szukaj utworu</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po tytule" className="w-full bg-transparent border hairline pl-9 pr-3 py-2 text-sm" />
          </label>
        </div>
      </div>
      {err && <p className="text-xs blood-text" role="alert">{err}</p>}
      {filtered && <p className="text-xs text-foreground/45">Kolejność zmienisz strzałkami po wyczyszczeniu wyszukiwania i filtra.</p>}
      {!shown.length && <p className="text-sm text-foreground/45">{rows.length ? "Nic nie pasuje do wyboru." : "Brak utworów."}</p>}
      <ul className="space-y-2">
        {shown.map((r) => {
          const i = rows.indexOf(r);
          const status = statusOf(r);
          const pub = status === "opublikowany";
          const p = plays(r.tytul);
          return (
            <li key={r.id} className={`border hairline p-3 flex flex-wrap items-center gap-3 ${pub ? "" : "opacity-75"}`}>
              {!filtered && (
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Wyżej" className="text-foreground/50 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Niżej" className="text-foreground/50 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
              )}
              <span className="technical text-[9px] text-foreground/40 w-6 text-right">{String(i + 1).padStart(2, "0")}</span>
              <button onClick={() => setEdit(r)} className="h-11 w-11 shrink-0 overflow-hidden rounded border hairline bg-[#161618]" title={r.okladka ? "Edytuj utwór" : "Brak okładki — dodaj w edycji"}>
                {r.okladka ? <img src={r.okladka} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center"><Music className="h-4 w-4 text-foreground/40" /></span>}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{r.wyrozniony && <Star className="inline h-3.5 w-3.5 gold-text mr-1" aria-label="Wyróżniony" />}{r.tytul}</p>
                <p className="text-xs text-foreground/50">{[r.autor || "EXMORTIS", r.kategoria].filter(Boolean).join(" · ")}</p>
              </div>
              {p && (
                <span className="text-xs text-foreground/60 shrink-0" title="Odsłuchania na stronie Głos: ostatnie 90 dni · ostatnie 7 dni">
                  <Headphones className="inline h-3.5 w-3.5 mr-1 gold-text" aria-hidden="true" />
                  <span className="font-mono gold-text">{p.n}</span> · 7 dni: {p.n7}
                </span>
              )}
              <SourceBadge src={sourceOf(r)} />
              <span className={`shrink-0 border px-2 py-0.5 text-[11px] ${pub ? "border-emerald-500/40 text-emerald-400" : status === "szkic" ? "border-[#C9A24A]/40 gold-text" : "hairline text-foreground/55"}`}>{ST[status]}</span>
              <button onClick={() => toggle(r)} aria-label={pub ? "Ukryj na stronie" : "Opublikuj"} title={pub ? "Ukryj na stronie" : "Opublikuj"} className={pub ? "gold-text" : "text-foreground/50 hover:text-foreground"}>
                {pub ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button onClick={() => setEdit(r)} aria-label="Edytuj" className="text-foreground/60 hover:text-[#C9A24A]"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(r)} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
