import React, { useState } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import SlotRow from "./SlotRow";
import Warn from "./Warn";
import PreviewButton from "./PreviewButton";
import { SLOTS, ST, trackWarnings } from "./silenceUtils";

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-xs text-foreground/60">
    <Switch checked={checked} onCheckedChange={onChange} /> {label}
  </label>
);

export default function SoundtrackRow({ t, onMove, isFirst, isLast, reload, fadeMs }) {
  const [name, setName] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const save = async (patch) => { await ST.update(t.id, patch); reload(); };
  const setDefault = async (v) => {
    if (v) await ST.updateMany({ czas_min: t.czas_min, domyslny: true }, { $set: { domyslny: false } });
    await save({ domyslny: v });
  };

  return (
    <div className="border hairline p-4 bg-[#0A0A0B]">
      <div className="flex items-center gap-2 mb-3">
        {name === null ? (
          <>
            <p className="shop-heading text-xl text-[#F5EFE1] flex-1">{t.nazwa}</p>
            <button onClick={() => setName(t.nazwa)} className="p-1.5 text-foreground/50 hover:text-[#C9A24A]" aria-label="Edytuj nazwę"><Pencil className="h-4 w-4" strokeWidth={1.25} /></button>
          </>
        ) : (
          <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) await save({ nazwa: name.trim() }); setName(null); }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-transparent border hairline px-3 py-1.5 text-sm" />
            <button className="technical text-[9px] gold-text">ZAPISZ</button>
          </form>
        )}
        <button disabled={isFirst} onClick={() => onMove(-1)} className="p-1.5 text-foreground/50 disabled:opacity-20" aria-label="Wyżej"><ArrowUp className="h-4 w-4" strokeWidth={1.25} /></button>
        <button disabled={isLast} onClick={() => onMove(1)} className="p-1.5 text-foreground/50 disabled:opacity-20" aria-label="Niżej"><ArrowDown className="h-4 w-4" strokeWidth={1.25} /></button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
        <Toggle label="Aktywny" checked={t.aktywny !== false} onChange={(v) => save({ aktywny: v })} />
        <Toggle label="Domyślny dla tego czasu" checked={!!t.domyslny} onChange={setDefault} />
        <Toggle label="Zapętlaj melodię" checked={t.zapetlaj_melodie !== false} onChange={(v) => save({ zapetlaj_melodie: v })} />
      </div>

      {SLOTS.map((s) => <SlotRow key={s.key} t={t} slot={s} reload={reload} />)}

      <div className="space-y-2 mt-3">{trackWarnings(t).map((w) => <Warn key={w} text={w} />)}</div>

      <div className="flex items-center justify-between mt-4 gap-3">
        <PreviewButton t={t} fadeMs={fadeMs} />
        {confirm ? (
          <span className="flex items-center gap-3 text-xs">
            Usunąć podkład?
            <button onClick={async () => { await ST.delete(t.id); reload(); }} className="technical text-[9px] blood-text">TAK, USUŃ</button>
            <button onClick={() => setConfirm(false)} className="technical text-[9px] text-foreground/50">ANULUJ</button>
          </span>
        ) : (
          <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 technical text-[9px] text-foreground/40 hover:text-[#BC1E22]">
            <Trash2 className="h-3 w-3" strokeWidth={1.25} /> USUŃ PODKŁAD
          </button>
        )}
      </div>
    </div>
  );
}