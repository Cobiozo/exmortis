import React, { useEffect, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { INPUT, LABEL, toLocal, fromLocal, fmtPl } from "./annForm";

const KOMU = [["wszyscy", "Wszyscy odwiedzający"], ["goscie", "Tylko niezalogowani (nowe osoby)"], ["zalogowani", "Tylko zalogowani"]];

// Panel → Ogłoszenia → Popup na stronie. Każdy odwiedzający widzi go raz; po zapisie (nowa wersja) — znowu.
export default function PopupSettings() {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    base44.functions.invoke("adminSettings", { action: "get_popup" })
      .then((r) => setF(r.data.popup))
      .catch((e) => setErr(e?.response?.data?.error || "Nie udało się wczytać popupu."));
  }, []);

  if (!f) return err ? <p className="text-sm blood-text">{err}</p> : <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async (patch = {}) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await base44.functions.invoke("adminSettings", { action: "save", target: "popup", data: { ...f, ...patch } });
      setF(r.data.popup);
      setMsg(r.data.popup.aktywny ? "Zapisane. Popup jest włączony — odwiedzający zobaczą go w ciągu kilku minut." : "Zapisane. Popup jest wyłączony.");
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się zapisać.");
    } finally { setBusy(false); }
  };

  return (
    <section className="border border-[#3D3D3F] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="technical text-[11px] gold-text">POPUP NA STRONIE</p>
          <p className="text-sm text-foreground/60 mt-2 max-w-[65ch]">
            Okienko dla odwiedzających, np. o nadchodzącym spotkaniu albo kodzie rabatowym. Każda osoba widzi je raz;
            po zapisie zmian pokaże się ponownie. Nie pojawia się w kasie, płatności, teście ani na stronach prawnych.
          </p>
        </div>
        <span className={`technical text-[10px] ${f.aktywny ? "gold-text" : "text-foreground/45"}`}>{f.aktywny ? "WŁĄCZONY" : "WYŁĄCZONY"}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2"><span className={LABEL}>TYTUŁ</span>
          <input className={INPUT} maxLength={120} value={f.tytul} onChange={(e) => set("tytul", e.target.value)} placeholder="np. Spotkanie online 20 listopada" /></label>
        <label className="sm:col-span-2"><span className={LABEL}>TREŚĆ</span>
          <textarea className={INPUT} rows={4} maxLength={800} value={f.tresc} onChange={(e) => set("tresc", e.target.value)} placeholder="Krótko: co, kiedy, dla kogo." /></label>
        <label><span className={LABEL}>NAPIS NA PRZYCISKU (OPCJONALNIE)</span>
          <input className={INPUT} maxLength={40} value={f.przycisk_napis} onChange={(e) => set("przycisk_napis", e.target.value)} placeholder="np. Zapisz się" /></label>
        <label><span className={LABEL}>LINK PRZYCISKU</span>
          <input className={INPUT} maxLength={500} value={f.przycisk_link} onChange={(e) => set("przycisk_link", e.target.value)} placeholder="/spotkania albo https://…" /></label>
        <label><span className={LABEL}>KOD RABATOWY DO POKAZANIA (OPCJONALNIE)</span>
          <input className={INPUT} maxLength={40} value={f.kod} onChange={(e) => set("kod", e.target.value.toUpperCase())} placeholder="np. POWROT20" />
          <span className="block text-xs text-foreground/45 mt-1">Sam kod tworzysz w Panel → Kody rabatowe — tu tylko go pokazujesz.</span></label>
        <label><span className={LABEL}>KOMU POKAZAĆ</span>
          <select className={INPUT} value={f.komu} onChange={(e) => set("komu", e.target.value)}>
            {KOMU.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label><span className={LABEL}>OD (OPCJONALNIE)</span>
          <input type="datetime-local" className={INPUT} value={toLocal(f.od)} onChange={(e) => set("od", fromLocal(e.target.value))} /></label>
        <label><span className={LABEL}>DO (OPCJONALNIE)</span>
          <input type="datetime-local" className={INPUT} value={toLocal(f.do)} onChange={(e) => set("do", fromLocal(e.target.value))} /></label>
        <label><span className={LABEL}>POKAŻ PO (SEKUNDACH)</span>
          <input type="number" min={0} max={60} className={INPUT} value={f.opoznienie} onChange={(e) => set("opoznienie", e.target.value)} /></label>
      </div>

      {(f.od || f.do) && <p className="text-xs text-foreground/50">Widoczny {f.od ? `od ${fmtPl(f.od)}` : "od teraz"}{f.do ? ` do ${fmtPl(f.do)}` : ""}.</p>}
      {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
      {err && <p className="text-sm blood-text" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <button className="btn-relic" disabled={busy} onClick={() => save({ aktywny: true })}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : f.aktywny ? "ZAPISZ ZMIANY" : "ZAPISZ I WŁĄCZ"}
        </button>
        {f.aktywny && <button className="btn-ghost" disabled={busy} onClick={() => save({ aktywny: false })}>WYŁĄCZ POPUP</button>}
        {f.aktywny && (
          <a href="/?popup=1" target="_blank" rel="noopener" className="btn-ghost"><ExternalLink className="h-4 w-4" /> PODGLĄD NA STRONIE</a>
        )}
      </div>
    </section>
  );
}
