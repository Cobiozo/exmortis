import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import BgMediaFields from "./BgMediaFields";
import BgLivePreview from "./BgLivePreview";
import { backgroundLum, requiredDim } from "./contrast";

const inp = "w-full bg-transparent border hairline px-3 py-2 text-sm";
const TYPES = [["kolor", "Kolor"], ["gradient", "Gradient"], ["zdjecie", "Zdjęcie"], ["wideo", "Wideo"]];

export default function BackgroundEditor({ initial, trackNames, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [need, setNeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    let live = true;
    backgroundLum(f).then((L) => live && setNeed(requiredDim(L)));
    return () => { live = false; };
  }, [f.typ, f.kolor, (f.kolory || []).join(), f.zdjecie_szerokie, f.zdjecie_pionowe, f.poster]); // eslint-disable-line react-hooks/exhaustive-deps

  const dim = Number(f.przyciemnienie) || 0;
  const tooBright = dim < need;
  const blocked = (f.aktywne && tooBright) || !f.nazwa;

  const save = async () => {
    setSaving(true);
    await onSave({ ...f, min_przyciemnienie: need });
    setSaving(false);
  };

  return (
    <div className="border hairline p-5 space-y-5">
      <p className="text-xs text-foreground/50 leading-relaxed">
        Najlepiej sprawdzają się ciemne, spokojne obrazy bez wyraźnych szczegółów w centrum. Unikaj zdjęć z ludźmi patrzącymi w obiektyw, napisów i symboli religijnych.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={inp} placeholder="Nazwa (np. Świeca)" value={f.nazwa || ""} onChange={(e) => set({ nazwa: e.target.value })} />
        <select className={inp} value={f.typ} disabled={f.systemowe} onChange={(e) => set({ typ: e.target.value })}>
          {TYPES.map(([v, l]) => <option key={v} value={v} className="bg-[#0A0A0B]">{l}</option>)}
        </select>
      </div>
      {!f.systemowe && <BgMediaFields f={f} set={set} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-xs text-foreground/50">Przyciemnienie: {dim}%
          <input type="range" min="0" max="90" value={dim} onChange={(e) => set({ przyciemnienie: Number(e.target.value) })} className="w-full accent-[#C9A24A]" />
        </label>
        <label className="text-xs text-foreground/50">Rozmycie: {f.rozmycie || 0}px
          <input type="range" min="0" max="20" value={f.rozmycie || 0} onChange={(e) => set({ rozmycie: Number(e.target.value) })} className="w-full accent-[#C9A24A]" />
        </label>
      </div>
      {tooBright && <p className="text-xs text-[#E2C170]">Tło jest za jasne — widok będzie nieczytelny. Zwiększ przyciemnienie do min. {need}%.{f.aktywne && " Bez tego nie można zapisać aktywnego tła."}</p>}
      <div className="flex flex-wrap gap-5 text-sm items-center">
        {f.typ === "zdjecie" && <label className="flex gap-2 items-center"><input type="checkbox" checked={!!f.ruch} onChange={(e) => set({ ruch: e.target.checked })} /> Powolny ruch</label>}
        <label className="flex gap-2 items-center"><input type="checkbox" checked={!!f.aktywne} onChange={(e) => set({ aktywne: e.target.checked })} /> Aktywne</label>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={!!f.domyslne} onChange={(e) => set({ domyslne: e.target.checked })} /> Domyślne</label>
        <select className={`${inp} w-auto`} value={f.dzwiek_nazwa || ""} onChange={(e) => set({ dzwiek_nazwa: e.target.value })}>
          <option value="" className="bg-[#0A0A0B]">Pasujący dźwięk: brak</option>
          {trackNames.map((n) => <option key={n} value={n} className="bg-[#0A0A0B]">{n}</option>)}
        </select>
      </div>
      <BgLivePreview bg={{ ...f, id: f.id || "nowe" }} />
      <div className="flex gap-3">
        <button disabled={blocked || saving} onClick={save} className="btn-relic disabled:opacity-40">{saving ? "Zapisuję…" : "Zapisz tło"}</button>
        <button onClick={onCancel} className="btn-ghost">Anuluj</button>
      </div>
    </div>
  );
}

export const loadTrackNames = () =>
  base44.entities.SilenceSoundtrack.list({ distinct: "nazwa" }).then((p) => (p.items || []).filter(Boolean));