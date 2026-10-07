import React from "react";
import { X } from "lucide-react";
import { inp } from "./podAdmin";

export default function ListField({ label, value, onChange, max }) {
  return (
    <div className="text-xs text-foreground/60 space-y-2">{label}
      {value.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input className={inp} value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><X className="h-4 w-4" /></button>
        </div>
      ))}
      {value.length < max && <button type="button" onClick={() => onChange([...value, ""])} className="block gold-text">+ dodaj</button>}
    </div>
  );
}