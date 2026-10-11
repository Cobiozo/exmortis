import React from "react";
import { Plus, X } from "lucide-react";
import { inputCls } from "./api";

export default function QuestionsEditor({ value, onChange }) {
  const upd = (i, k, v) => onChange(value.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  return (
    <div className="space-y-2">
      <p className="technical text-[10px] gold-text">PYTANIA FORMULARZA</p>
      {value.map((q, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <input className={`${inputCls} flex-1 min-w-[200px]`} value={q.label} onChange={(e) => upd(i, "label", e.target.value)} />
          <label className="text-xs flex gap-1 items-center"><input type="checkbox" checked={!!q.required} onChange={(e) => upd(i, "required", e.target.checked)} /> wymagane</label>
          <label className="text-xs flex gap-1 items-center"><input type="checkbox" checked={!!q.health} onChange={(e) => upd(i, "health", e.target.checked)} /> dane o zdrowiu (szyfrowane)</label>
          <button onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Usuń pytanie"><X className="h-4 w-4 text-foreground/50" /></button>
        </div>
      ))}
      {value.length < 10 && (
        <button onClick={() => onChange([...value, { id: `q${Date.now() % 100000}`, label: "", required: false }])} className="text-xs gold-text inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Dodaj pytanie</button>
      )}
    </div>
  );
}