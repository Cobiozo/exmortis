import React from "react";
import { X } from "lucide-react";
import { bk, DAYS, plDateTime } from "./api";
import BlockForm from "./BlockForm";

export default function BlocksPanel({ blocks, onSaved }) {
  const del = async (id) => { await bk("delete_block", { id }); onSaved(); };
  return (
    <div className="space-y-8 max-w-3xl">
      <BlockForm onSaved={onSaved} />
      <div className="space-y-2">
        <p className="technical text-[10px] gold-text">AKTYWNE BLOKADY</p>
        {blocks.length === 0 && <p className="text-sm text-foreground/50">Brak blokad.</p>}
        {blocks.map((b) => (
          <div key={b.id} className="flex justify-between gap-3 border hairline p-3 text-sm">
            <span>
              <span className="technical text-[10px] gold-text mr-2">{b.kind}</span>
              {b.kind === "powtarzalna" ? `co ${DAYS[b.rep_weekday]} ${b.rep_from}–${b.rep_to}, ${plDateTime(b.starts_at)} → ${plDateTime(b.ends_at)}` : `${plDateTime(b.starts_at)} → ${plDateTime(b.ends_at)}`}
              {b.note && <span className="text-foreground/50"> · {b.note}</span>}
            </span>
            <button onClick={() => del(b.id)} aria-label="Usuń blokadę"><X className="h-4 w-4 text-foreground/50" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}