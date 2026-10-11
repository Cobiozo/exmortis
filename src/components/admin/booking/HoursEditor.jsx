import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { bk, inputCls, DAYS } from "./api";

// Tygodniowy szablon godzin pracy (czas polski).
export default function HoursEditor({ typeId, initial, onSaved }) {
  const [rows, setRows] = useState(initial.map(({ weekday, from, to }) => ({ weekday, from, to })));
  const [msg, setMsg] = useState("");
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    setMsg("");
    try { await bk("save_hours", { type_id: typeId, hours: rows.map((r) => ({ ...r, weekday: Number(r.weekday) })) }); setMsg("Zapisano godziny."); onSaved(); } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="border-t hairline pt-5 space-y-2">
      <p className="technical text-[10px] gold-text">GODZINY PRACY (CZAS PL)</p>
      {rows.length === 0 && <p className="text-sm text-foreground/50">Brak godzin — ten rodzaj nie ma wolnych terminów.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <select className={`${inputCls} w-24`} value={r.weekday} onChange={(e) => upd(i, "weekday", e.target.value)}>
            {DAYS.slice(1).map((d, j) => <option key={d} value={j + 1}>{d}</option>)}
          </select>
          <input type="time" className={`${inputCls} w-32 dt-input`} value={r.from} onChange={(e) => upd(i, "from", e.target.value)} />
          <span>–</span>
          <input type="time" className={`${inputCls} w-32 dt-input`} value={r.to} onChange={(e) => upd(i, "to", e.target.value)} />
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Usuń"><X className="h-4 w-4 text-foreground/50" /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 items-center pt-2">
        <button onClick={() => setRows([...rows, { weekday: 2, from: "10:00", to: "12:00" }])} className="text-xs gold-text inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Dodaj przedział</button>
        <button onClick={save} className="btn-ghost !py-2">ZAPISZ GODZINY</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
    </div>
  );
}