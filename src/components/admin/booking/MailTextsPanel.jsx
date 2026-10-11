import React, { useEffect, useState } from "react";
import { bk, inputCls } from "./api";

// MUSI 15: treści e-maili edytowalne w panelu. Bez odpowiedzi z formularza i bez danych o zdrowiu.
const NAMES = {
  potwierdzenie: "Potwierdzenie", przypomnienie24: "Przypomnienie 24 h", przypomnienie1: "Przypomnienie 1 h",
  przeniesienie: "Przeniesienie", anulowanie: "Anulowanie",
};
const VARS = ["{{imie}}", "{{rodzaj}}", "{{termin}}", "{{termin_lokalny}}", "{{zoom}}", "{{przenies}}", "{{anuluj}}"];

export default function MailTextsPanel() {
  const [texts, setTexts] = useState(null);
  const [open, setOpen] = useState("potwierdzenie");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { bk("mail_texts").then((r) => setTexts(r.texts)).catch((e) => setErr(e.message)); }, []);

  const set = (k, field, v) => setTexts((t) => ({ ...t, [k]: { ...t[k], [field]: v } }));
  const save = async () => {
    setErr(""); setMsg("");
    try {
      const r = await bk("save_mail_texts", { texts });
      setTexts(r.texts); setMsg("Zapisane.");
    } catch (e) { setErr(e.message); }
  };
  const reset = async (k) => {
    setErr("");
    const r = await bk("mail_texts").catch(() => null);
    if (r) setTexts((t) => ({ ...t, [k]: r.defaults[k] }));
  };

  if (err && !texts) return <p className="text-sm text-[#E8C547]">{err}</p>;
  if (!texts) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  const t = texts[open];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {Object.keys(NAMES).map((k) => (
          <button key={k} onClick={() => { setOpen(k); setMsg(""); setErr(""); }}
            className={`technical text-[10px] px-4 py-2 border ${open === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60"}`}>{NAMES[k]}</button>
        ))}
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="technical text-[10px] text-foreground/50">TEMAT</span>
          <input value={t.subject} onChange={(e) => set(open, "subject", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="technical text-[10px] text-foreground/50">TREŚĆ (HTML)</span>
          <textarea value={t.body} onChange={(e) => set(open, "body", e.target.value)} rows={12} className={inputCls} />
        </label>
        <p className="text-xs text-foreground/45">Pola: {VARS.join(" · ")}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={save} className="btn-relic !py-3 text-[10px]">ZAPISZ</button>
          <button onClick={() => reset(open)} className="btn-ghost !py-3 text-[10px]">PRZYWRÓĆ DOMYŚLNĄ</button>
        </div>
        {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
        {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      </div>
    </div>
  );
}