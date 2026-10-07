import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { TRACK } from "./libUtils";
import TrackForm from "./TrackForm";
import TrackRow from "./TrackRow";

export default function TracksTab() {
  const [tracks, setTracks] = useState(null);
  const [backdrops, setBackdrops] = useState([]);
  const [edit, setEdit] = useState(null); // null | "new" | track
  const load = () => TRACK.filter({}, { sort: "kolejnosc", limit: 200 }).then((p) => setTracks(p.items));
  useEffect(() => {
    load();
    base44.entities.SilenceBackground.filter({}, { sort: "kolejnosc", limit: 100, fields: ["nazwa"] }).then((p) => setBackdrops(p.items));
  }, []);

  if (!tracks) return <p className="text-foreground/50 text-sm">Ładowanie…</p>;

  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= tracks.length) return;
    await TRACK.bulkUpdate([{ id: tracks[i].id, kolejnosc: j }, { id: tracks[j].id, kolejnosc: i }]);
    load();
  };
  const remove = async (t) => {
    if (!window.confirm(`Usunąć utwór „${t.nazwa}”?`)) return;
    await TRACK.delete(t.id);
    load();
  };
  const done = () => { setEdit(null); load(); };

  return (
    <div className="space-y-3">
      {edit === "new" && <TrackForm tracks={tracks} backdrops={backdrops} order={tracks.length} onDone={done} onCancel={() => setEdit(null)} />}
      {edit !== "new" && <button onClick={() => setEdit("new")} className="btn-relic !py-3 !px-5">Dodaj utwór</button>}
      {!tracks.length && <p className="text-sm text-foreground/45">Biblioteka jest pusta — goście słyszą tylko wstęp i zakończenie.</p>}
      {tracks.map((t, i) =>
        edit?.id === t.id ? (
          <TrackForm key={t.id} track={t} tracks={tracks} backdrops={backdrops} onDone={done} onCancel={() => setEdit(null)} />
        ) : (
          <TrackRow key={t.id} t={t} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onEdit={() => setEdit(t)} onDelete={() => remove(t)} />
        )
      )}
    </div>
  );
}