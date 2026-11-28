import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PL, inp } from "./podAdmin";
import MusicPlaylistCard from "./MusicPlaylistCard";
import { confirmDialog } from "@/components/admin/ui/confirmDialog";
import { EmptyState } from "@/components/admin/ui/kit";

const OPEN_KEY = "exm_admin_pl_open";

// Playlisty muzyczne na /glos (zakładka Muzyka). Tworzy je tylko admin; słuchacz wybiera playlistę nad listą utworów.
export default function MusicPlaylistsTab() {
  const [pls, setPls] = useState(null);
  const [songs, setSongs] = useState([]);
  const [name, setName] = useState("");
  // Rozwinięte playlisty (27.11.2026): domyślnie wszystkie zwinięte; stan pamiętany w tej przeglądarce.
  const [open, setOpenState] = useState(() => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || "[]"); } catch { return []; } });
  const setOpen = (next) => { setOpenState(next); try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* bez pamięci */ } };
  const toggleOpen = (id) => setOpen(open.includes(id) ? open.filter((x) => x !== id) : [...open, id]);
  const load = () => PL.filter({}, { sort: "kolejnosc", limit: 100 }).then((r) => setPls((r.items || []).filter((p) => p.typ === "muzyka")));
  useEffect(() => {
    load();
    base44.entities.Utwor.filter({}, { sort: "kolejnosc", limit: 200 }).then((r) => setSongs(r.items || []));
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const made = await PL.create({ nazwa: name.trim(), typ: "muzyka", utwory: [], widoczna: true, kolejnosc: pls.length });
    setName("");
    if (made?.id) setOpen([...open, made.id]); // nowa playlista od razu rozwinięta
    load();
  };
  const save = async (p, patch) => { setPls((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); await PL.update(p.id, patch); };
  const del = async (p) => { if (await confirmDialog(`Usunąć playlistę „${p.nazwa}”? Utwory zostają.`)) { await PL.delete(p.id); load(); } };

  if (!pls) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa, np. Na trudne noce" className={`${inp} max-w-xs`} />
        <button className="btn-relic !py-2 !px-5">Dodaj playlistę</button>
      </form>
      {!pls.length && <EmptyState>Brak playlist muzycznych.</EmptyState>}
      {pls.length > 1 && (
        <div className="flex gap-4 text-xs">
          <button onClick={() => setOpen(pls.map((p) => p.id))} className="text-foreground/60 hover:gold-text">Rozwiń wszystkie</button>
          <button onClick={() => setOpen([])} className="text-foreground/60 hover:gold-text">Zwiń wszystkie</button>
        </div>
      )}
      <div className="space-y-3">
        {pls.map((p) => <MusicPlaylistCard key={p.id} p={p} songs={songs} open={open.includes(p.id)} onToggle={() => toggleOpen(p.id)} onSave={(patch) => save(p, patch)} onDelete={() => del(p)} />)}
      </div>
    </div>
  );
}