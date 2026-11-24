import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PL, inp } from "./podAdmin";
import MusicPlaylistCard from "./MusicPlaylistCard";

// Playlisty muzyczne na /glos (zakładka Muzyka). Tworzy je tylko admin; słuchacz wybiera playlistę nad listą utworów.
export default function MusicPlaylistsTab() {
  const [pls, setPls] = useState(null);
  const [songs, setSongs] = useState([]);
  const [name, setName] = useState("");
  const load = () => PL.filter({}, { sort: "kolejnosc", limit: 100 }).then((r) => setPls((r.items || []).filter((p) => p.typ === "muzyka")));
  useEffect(() => {
    load();
    base44.entities.Utwor.filter({}, { sort: "kolejnosc", limit: 200 }).then((r) => setSongs(r.items || []));
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await PL.create({ nazwa: name.trim(), typ: "muzyka", utwory: [], widoczna: true, kolejnosc: pls.length });
    setName("");
    load();
  };
  const save = async (p, patch) => { setPls((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); await PL.update(p.id, patch); };
  const del = async (p) => { if (window.confirm(`Usunąć playlistę „${p.nazwa}”? Utwory zostają.`)) { await PL.delete(p.id); load(); } };

  if (!pls) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa, np. Na trudne noce" className={`${inp} max-w-xs`} />
        <button className="btn-relic !py-2 !px-5">Dodaj playlistę</button>
      </form>
      {!pls.length && <p className="text-sm text-foreground/45">Brak playlist muzycznych.</p>}
      {pls.map((p) => <MusicPlaylistCard key={p.id} p={p} songs={songs} onSave={(patch) => save(p, patch)} onDelete={() => del(p)} />)}
    </div>
  );
}