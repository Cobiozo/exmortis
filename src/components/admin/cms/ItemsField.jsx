import React from "react";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import FieldInput from "./FieldInput";
import { labelCls, smallBtn } from "./ui";

// Lista elementów (karty, etapy, pytania) z kolejnością.
export default function ItemsField({ f, value, onChange, extra }) {
  const set = (i, patch) => onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i, d) => { const a = [...value]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div className="space-y-4">
      {value.map((it, i) => (
        <div key={i} className="border hairline p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className={labelCls}>{String(i + 1).padStart(2, "0")}</span>
            <div className="flex gap-3 text-foreground/40">
              <button type="button" disabled={!i} onClick={() => move(i, -1)} aria-label="Wyżej" className="disabled:opacity-30 hover:text-[#C9A24A]"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Niżej" className="disabled:opacity-30 hover:text-[#C9A24A]"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Usuń" className="hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          {f.sub.map((s) => <FieldInput key={s.k} f={s} value={it[s.k]} onChange={(v) => set(i, { [s.k]: v })} extra={extra} />)}
        </div>
      ))}
      {value.length < (f.maxItems || 20) && (
        <button type="button" onClick={() => onChange([...value, {}])} className={smallBtn}><Plus className="h-4 w-4" /> Dodaj</button>
      )}
    </div>
  );
}