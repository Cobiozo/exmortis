import React, { useState } from "react";
import { bk, inputCls, DAYS, plDateTime } from "./api";

// „Jestem niedostępny”: od–do (czas PL), cały dzień / kilka dni, albo powtarzalnie co tydzień.
const toIso = (local) => new Date(local).toISOString();

export default function BlockForm({ onSaved }) {
  const [f, setF] = useState({ kind: "jednorazowa", from: "", to: "", day_from: "", day_to: "", rep_weekday: 1, rep_from: "09:00", rep_to: "12:00", note: "" });
  const [msg, setMsg] = useState(""); const [coll, setColl] = useState([]); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async () => {
    setBusy(true); setMsg(""); setColl([]);
    try {
      const allDay = f.kind !== "jednorazowa";
      if (allDay ? !f.day_from : !f.from || !f.to) throw new Error("Uzupełnij daty.");
      const dayTo = f.day_to || f.day_from;
      const end = new Date(`${dayTo}T00:00`); end.setDate(end.getDate() + 1);
      const block = allDay ? { kind: f.kind, starts_at: toIso(`${f.day_from}T00:00`), ends_at: end.toISOString() } : { kind: "jednorazowa", starts_at: toIso(f.from), ends_at: toIso(f.to) };
      const r = await bk("save_block", { block: { ...block, rep_weekday: Number(f.rep_weekday), rep_from: f.rep_from, rep_to: f.rep_to, note: f.note } });
      setColl(r.collisions || []); setMsg("Zapisano blokadę."); onSaved();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-6 space-y-4">
      <p className="technical text-[10px] gold-text">JESTEM NIEDOSTĘPNY</p>
      <select className={inputCls} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
        <option value="jednorazowa">Od–do (godziny)</option><option value="calodniowa">Cały dzień / kilka dni</option><option value="powtarzalna">Powtarzalnie co tydzień</option>
      </select>
      {f.kind === "jednorazowa" ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="datetime-local" className={`${inputCls} dt-input`} value={f.from} onChange={(e) => set("from", e.target.value)} />
          <input type="datetime-local" className={`${inputCls} dt-input`} value={f.to} onChange={(e) => set("to", e.target.value)} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">{f.kind === "powtarzalna" ? "Obowiązuje od" : "Od dnia"}<input type="date" className={`${inputCls} dt-input`} value={f.day_from} onChange={(e) => set("day_from", e.target.value)} /></label>
          <label className="text-sm">{f.kind === "powtarzalna" ? "Do dnia" : "Do dnia (opcj.)"}<input type="date" className={`${inputCls} dt-input`} value={f.day_to} onChange={(e) => set("day_to", e.target.value)} /></label>
        </div>
      )}
      {f.kind === "powtarzalna" && (
        <div className="flex flex-wrap gap-2 items-center">
          <select className={`${inputCls} w-24`} value={f.rep_weekday} onChange={(e) => set("rep_weekday", e.target.value)}>{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
          <input type="time" className={`${inputCls} w-32 dt-input`} value={f.rep_from} onChange={(e) => set("rep_from", e.target.value)} />–
          <input type="time" className={`${inputCls} w-32 dt-input`} value={f.rep_to} onChange={(e) => set("rep_to", e.target.value)} />
        </div>
      )}
      <input className={inputCls} placeholder="Notatka (widzi tylko admin)" value={f.note} onChange={(e) => set("note", e.target.value)} />
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ"}</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
      {coll.length > 0 && (
        <div className="border border-[#BC1E22] p-4 text-sm">
          <p className="blood-text technical text-[10px] mb-2">UWAGA: W TYM CZASIE SĄ REZERWACJE (NIE ZOSTAŁY ANULOWANE)</p>
          {coll.map((c) => <p key={c.id}>{plDateTime(c.starts_at)} · {c.type} · {c.first_name}</p>)}
        </div>
      )}
    </div>
  );
}