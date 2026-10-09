import React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { inputCls, smallBtn } from "../ui";
import { linkError } from "@/components/cms/links";

// Lista par etykieta + link z kolejnością, dodawaniem i usuwaniem.
export default function LinkRows({ rows, onChange, max = 12 }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => { const n = [...rows]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const err = linkError(r.to);
        return (
          <div key={i}>
            <div className="flex gap-2 items-center">
              <input className={inputCls} value={r.label} placeholder="Etykieta" onChange={(e) => set(i, { label: e.target.value })} />
              <input className={inputCls} value={r.to} placeholder="/adres lub https://" onChange={(e) => set(i, { to: e.target.value })} />
              <button className={smallBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Wyżej"><ArrowUp className="h-4 w-4" /></button>
              <button className={smallBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Niżej"><ArrowDown className="h-4 w-4" /></button>
              <button className={smallBtn} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>
            </div>
            {err && <p className="text-xs blood-text mt-1">Link: {err}</p>}
          </div>
        );
      })}
      {rows.length < max && <button className={smallBtn} onClick={() => onChange([...rows, { label: "", to: "/" }])}><Plus className="h-4 w-4" /> Dodaj link</button>}
    </div>
  );
}