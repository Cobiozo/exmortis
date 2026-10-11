import React, { useState } from "react";
import { bk, inputCls } from "./api";

const MODES = [
  ["off", "WYŁĄCZONY", "Aplikacja działa tak jak dotąd. Moduł niewidoczny dla nikogo."],
  ["admin", "TYLKO ADMIN", "Moduł widoczny wyłącznie dla kont administratora — do testów."],
  ["on", "WŁĄCZONY", "Rezerwacje dostępne dla klientów."],
];

export default function ModeSettings({ settings, onSaved }) {
  const [f, setF] = useState({ mode: settings.mode, daily_limit: settings.daily_limit, weekly_limit: settings.weekly_limit ?? "" });
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg("");
    try { await bk("save_settings", f); setMsg("Zapisano."); onSaved(); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-3">
        <p className="technical text-[10px] gold-text">PRZEŁĄCZNIK MODUŁU</p>
        {MODES.map(([v, l, d]) => (
          <label key={v} className={`flex gap-3 p-4 border cursor-pointer ${f.mode === v ? "border-[#C9A24A]" : "hairline"}`}>
            <input type="radio" name="mode" checked={f.mode === v} onChange={() => setF({ ...f, mode: v })} />
            <span><span className="technical text-xs">{l}</span><span className="block text-sm text-foreground/60 mt-1">{d}</span></span>
          </label>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="text-sm">Minimalne wyprzedzenie<input className={inputCls} value="24 h" disabled /></label>
        <label className="text-sm">Limit sesji dziennie<input type="number" min="1" max="20" className={inputCls} value={f.daily_limit} onChange={(e) => setF({ ...f, daily_limit: e.target.value })} /></label>
        <label className="text-sm">Limit tygodniowy (opcj.)<input type="number" min="1" className={inputCls} value={f.weekly_limit} onChange={(e) => setF({ ...f, weekly_limit: e.target.value })} /></label>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ"}</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
    </div>
  );
}