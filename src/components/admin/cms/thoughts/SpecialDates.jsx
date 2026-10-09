import React from "react";
import { Trash2, Plus } from "lucide-react";
import { MAX } from "@/content/thoughts";

const IN = "min-h-[40px] bg-transparent border border-[#3D3D3F] px-3 text-sm focus:border-[#C9A24A] outline-none";

// d w formacie MM-DD (co roku).
export default function SpecialDates({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={x.d} placeholder="MM-DD" maxLength={5} onChange={(e) => set(i, { d: e.target.value })} className={`${IN} w-24`} />
          <input value={x.t} maxLength={MAX} onChange={(e) => set(i, { t: e.target.value })} className={`${IN} flex-1`} />
          <span className="technical text-[10px] text-foreground/40 w-14 text-right">{x.t.length}/{MAX}</span>
          <button type="button" className="p-2 text-foreground/50 hover:text-[#C9A24A]" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { d: "", t: "" }])} className="btn-ghost !py-2 mt-2"><Plus className="h-4 w-4" /> DODAJ DATĘ</button>
    </div>
  );
}