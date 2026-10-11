import React, { useEffect, useState } from "react";
import { bk, inputCls } from "./api";

const MODES = [
  ["off", "WYŁĄCZONY", "Aplikacja działa tak jak dotąd. Moduł niewidoczny dla nikogo."],
  ["admin", "TYLKO ADMIN", "Moduł widoczny wyłącznie dla kont administratora — do testów."],
  ["on", "WŁĄCZONY", "Rezerwacje dostępne dla klientów."],
];

const POLICIES = [
  ["admin", "DECYDUJE ADMIN", "Późne odwołanie zapisujemy, sesja zostaje. Czy ją oddać, decydujesz w zakładce Pakiety."],
  ["przepada", "SESJA PRZEPADA", "Późne odwołanie oznacza utratę sesji z pakietu."],
];

export default function ModeSettings({ settings, types = [], onSaved }) {
  const [f, setF] = useState({
    mode: settings.mode,
    daily_limit: settings.daily_limit,
    weekly_limit: settings.weekly_limit ?? "",
    late_cancel_policy: settings.late_cancel_policy || "admin",
    threshold_product_id: settings.threshold_product_id || "",
    threshold_type_id: settings.threshold_type_id || "",
    threshold_sessions: settings.threshold_sessions ?? 1,
    threshold_valid_days: settings.threshold_valid_days ?? 60,
    service_consent_version: settings.service_consent_version || "",
    service_consent_text: settings.service_consent_text || "",
  });
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { bk("products").then((d) => setProducts(d.products || [])).catch(() => {}); }, []);

  const save = async () => {
    setBusy(true); setMsg("");
    try { await bk("save_settings", f); setMsg("Zapisano."); onSaved(); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <div className="max-w-2xl space-y-10">
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

      <div className="space-y-3">
        <p className="technical text-[10px] gold-text">PÓŹNE ODWOŁANIE</p>
        {POLICIES.map(([v, l, d]) => (
          <label key={v} className={`flex gap-3 p-4 border cursor-pointer ${f.late_cancel_policy === v ? "border-[#C9A24A]" : "hairline"}`}>
            <input type="radio" name="policy" checked={f.late_cancel_policy === v} onChange={() => setF({ ...f, late_cancel_policy: v })} />
            <span><span className="technical text-xs">{l}</span><span className="block text-sm text-foreground/60 mt-1">{d}</span></span>
          </label>
        ))}
      </div>

      <div className="space-y-4">
        <p className="technical text-[10px] gold-text">ROZMOWA NA PROGU</p>
        <label className="text-sm block">Produkt skarbca (wybór po identyfikatorze)
          <select className={inputCls} value={f.threshold_product_id} onChange={(e) => setF({ ...f, threshold_product_id: e.target.value })}>
            <option value="">— brak —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {String(p.id).slice(0, 8)}</option>)}
          </select>
        </label>
        <label className="text-sm block">Rodzaj spotkania z pakietu
          <select className={inputCls} value={f.threshold_type_id} onChange={(e) => setF({ ...f, threshold_type_id: e.target.value })}>
            <option value="">— brak —</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">Liczba sesji w pakiecie<input type="number" min="1" max="20" className={inputCls} value={f.threshold_sessions} onChange={(e) => setF({ ...f, threshold_sessions: e.target.value })} /></label>
          <label className="text-sm">Ważność linku (dni)<input type="number" min="1" max="365" className={inputCls} value={f.threshold_valid_days} onChange={(e) => setF({ ...f, threshold_valid_days: e.target.value })} /></label>
        </div>
        <label className="text-sm block">Treść zgody o wykonaniu usługi (14 dni)
          <textarea rows={3} className={inputCls} value={f.service_consent_text} onChange={(e) => setF({ ...f, service_consent_text: e.target.value })} />
        </label>
        <label className="text-sm block">Wersja zgody<input className={inputCls} value={f.service_consent_version} onChange={(e) => setF({ ...f, service_consent_version: e.target.value })} /></label>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ"}</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
    </div>
  );
}