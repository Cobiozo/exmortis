import React, { useState } from "react";
import { bk, inputCls } from "./api";
import HoursEditor from "./HoursEditor";
import QuestionsEditor from "./QuestionsEditor";
import ZoomChoice from "@/components/admin/zoom/ZoomChoice";

const NUM = [["duration_min", "Długość (min)"], ["buffer_before", "Bufor przed"], ["buffer_after", "Bufor po"], ["step_min", "Krok slotów"],
  ["horizon_days", "Horyzont (dni)"], ["change_window_h", "Zmiana/anulowanie do (h przed)"], ["monthly_limit", "Limit w miesiącu"]];

export default function TypeEditor({ type, onSaved }) {
  const [t, setT] = useState(type);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setT({ ...t, [k]: v });
  const save = async () => {
    setBusy(true); setMsg("");
    try { await bk("save_type", { type: t }); setMsg("Zapisano."); onSaved(); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="relic-heading text-xl">{type.name}</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.active} onChange={(e) => set("active", e.target.checked)} /> Aktywny</label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Nazwa<input className={inputCls} value={t.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="text-sm">Dostęp<select className={inputCls} value={t.access} onChange={(e) => set("access", e.target.value)}>
          <option value="PUBLICZNY">Publiczny</option><option value="PO_ZAKUPIE">Po zakupie</option><option value="PAKIET">Pakiet</option></select></label>
        <label className="text-sm sm:col-span-2">Opis<textarea rows={2} className={inputCls} value={t.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
        <div className="text-sm sm:col-span-2 space-y-2 min-w-0">
          <p>Link Zoom (widzi tylko admin i właściciel potwierdzonej rezerwacji, od 15 minut przed sesją)</p>
          <ZoomChoice link={t.zoom_link} onSet={({ link }) => set("zoom_link", link)}>
            <input aria-label="Link Zoom" className={inputCls} value={t.zoom_link || ""} onChange={(e) => set("zoom_link", e.target.value)} placeholder="https://" />
          </ZoomChoice>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {NUM.map(([k, l]) => <label key={k} className="text-sm">{l}<input type="number" className={inputCls} value={t[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></label>)}
      </div>
      <QuestionsEditor value={t.questions || []} onChange={(q) => set("questions", q)} />
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ RODZAJ"}</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
      <HoursEditor typeId={type.id} initial={type.hours} onSaved={onSaved} />
    </div>
  );
}