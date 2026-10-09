import React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { MAX } from "@/content/thoughts";

const IN = "flex-1 min-h-[40px] bg-transparent border border-[#3D3D3F] px-3 text-sm focus:border-[#C9A24A] outline-none";
const ICO = "p-2 text-foreground/50 hover:text-[#C9A24A] disabled:opacity-20";

export default function ThoughtsList({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={i} className={`flex items-center gap-2 ${x.on === false ? "opacity-40" : ""}`}>
          <span className="technical text-[10px] text-foreground/40 w-6">{i + 1}</span>
          <input value={x.t} maxLength={MAX} onChange={(e) => set(i, { t: e.target.value })} className={IN} />
          <span className="technical text-[10px] text-foreground/40 w-14 text-right">{x.t.length}/{MAX}</span>
          <label className="technical text-[10px] flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={x.on !== false} onChange={(e) => set(i, { on: e.target.checked })} /> WŁ.
          </label>
          <button type="button" className={ICO} disabled={i === 0} onClick={() => move(i, -1)} aria-label="W górę"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" className={ICO} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="W dół"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" className={ICO} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { t: "", on: true }])} className="btn-ghost !py-2 mt-2"><Plus className="h-4 w-4" /> DODAJ ZDANIE</button>
    </div>
  );
}