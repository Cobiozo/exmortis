import React from "react";
import { Plus, Trash2 } from "lucide-react";
import LinkPicker from "./LinkPicker";
import { inputCls, labelCls, smallBtn } from "./ui";

const STYLES = [["zloty", "Złoty pełny"], ["obrys", "Obrys"], ["tekst", "Tekstowy"]];

export default function ButtonsField({ value = [], onChange, max = 3, extra }) {
  const set = (i, patch) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-4">
      {value.map((b, i) => (
        <div key={i} className="border hairline p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className={labelCls}>PRZYCISK {i + 1}</span>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Usuń przycisk" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
          </div>
          <input className={inputCls} value={b.etykieta || ""} placeholder="Etykieta" onChange={(e) => set(i, { etykieta: e.target.value })} />
          <LinkPicker value={b.link} onChange={(link) => set(i, { link })} extra={extra} />
          <div className="grid sm:grid-cols-2 gap-3">
            <select className={inputCls} value={b.styl || "zloty"} onChange={(e) => set(i, { styl: e.target.value })}>
              {STYLES.map(([v, l]) => <option key={v} value={v} className="bg-[#0F0F10]">{l}</option>)}
            </select>
            <div className="flex flex-col justify-center gap-1 text-sm text-foreground/70">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.nowa_karta} onChange={(e) => set(i, { nowa_karta: e.target.checked })} /> Otwórz w nowej karcie</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.strzalka} onChange={(e) => set(i, { strzalka: e.target.checked })} /> Strzałka</label>
            </div>
          </div>
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, { etykieta: "", link: "", styl: "zloty" }])} className={smallBtn}><Plus className="h-4 w-4" /> Dodaj przycisk</button>
      )}
    </div>
  );
}