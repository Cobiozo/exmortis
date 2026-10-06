import React, { useState } from "react";
import { Plus } from "lucide-react";
import SoundtrackRow from "./SoundtrackRow";
import AddSoundtrackForm from "./AddSoundtrackForm";
import Warn from "./Warn";
import { ST, timeWarning } from "./silenceUtils";

// Karta jednego czasu minutnika.
export default function TimeCard({ minutes, tracks, reload, fadeMs }) {
  const [adding, setAdding] = useState(false);
  const warn = timeWarning(tracks);

  const move = async (i, dir) => {
    const list = [...tracks];
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    await ST.bulkUpdate(list.map((t, k) => ({ id: t.id, kolejnosc: k })));
    reload();
  };

  return (
    <div className="border hairline p-5 md:p-6 bg-[#0F0F10]">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="relic-heading text-3xl">{minutes} min</h3>
        <span className="technical text-[9px] text-foreground/40">PODKŁADY: {tracks.length}</span>
      </div>
      {warn && <div className="mb-4"><Warn text={warn} /></div>}
      <div className="space-y-4">
        {tracks.map((t, i) => (
          <SoundtrackRow
            key={t.id} t={t} reload={reload} fadeMs={fadeMs}
            isFirst={i === 0} isLast={i === tracks.length - 1} onMove={(d) => move(i, d)}
          />
        ))}
      </div>
      {adding ? (
        <AddSoundtrackForm
          minutes={minutes} order={tracks.length} isFirst={tracks.length === 0}
          onDone={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)}
        />
      ) : (
        <button onClick={() => setAdding(true)} className="btn-ghost mt-6 !py-3">
          <Plus className="h-4 w-4" strokeWidth={1.25} /> Dodaj podkład
        </button>
      )}
    </div>
  );
}