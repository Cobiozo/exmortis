import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { rz } from "./rzApi";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2.5 text-sm text-foreground focus:border-[#C9A24A] focus:outline-none";
const lab = "technical text-[10px] text-foreground/55 block mb-1.5";

// Usługa generowania obrazów ROZDROŻY: Base44 AI albo OpenAI z kluczem API.
// Klucz wklejasz tylko tutaj; serwer go zapisuje i nigdy nie odsyła (widać wyłącznie 4 ostatnie znaki).
export default function AiSettings() {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const apply = (x) => { setD(x); setF({ provider: x.provider, model: x.model, quality: x.quality }); };
  useEffect(() => { rz("ai_get").then(apply).catch((e) => setErr(e.message)); }, []);

  const save = async (extra = {}) => {
    setBusy(extra.remove_key ? "rm" : "save"); setMsg(""); setErr("");
    try { apply(await rz("ai_save", { ...f, openai_key: key, ...extra })); setKey(""); setMsg("Zapisano."); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };

  if (!f) return err ? <p className="text-sm text-[#E8676A]">{err}</p> : null;
  const oa = f.provider === "openai";
  return (
    <details className="border hairline p-5 md:p-6">
      <summary className="cursor-pointer shop-heading text-xl text-[#F5EFE1]">Usługa generowania obrazów <span className="technical text-[10px] text-foreground/50 ml-2">{d.provider === "openai" ? `OPENAI · ${d.model}` : "BASE44 AI"}</span></summary>
      <div className="mt-5 space-y-5 max-w-2xl">
        <fieldset className="space-y-2">
          <legend className={lab}>KTO GENERUJE KADRY</legend>
          <label className="flex items-start gap-3 text-sm text-foreground/80 cursor-pointer">
            <input type="radio" name="rz-ai" className="mt-1 accent-[#C9A24A]" checked={!oa} onChange={() => setF({ ...f, provider: "base44" })} />
            <span>Base44 AI — z kredytów AI aplikacji. Bez wzoru postaci.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground/80 cursor-pointer">
            <input type="radio" name="rz-ai" className="mt-1 accent-[#C9A24A]" checked={oa} onChange={() => setF({ ...f, provider: "openai" })} />
            <span>OpenAI — płatne z Twojego konta API (platform.openai.com, osobno od subskrypcji ChatGPT). Obsługuje wzór postaci, czyli lepszą ciągłość bohaterów.</span>
          </label>
        </fieldset>
        {oa && (
          <div className="grid gap-4">
            <label className="block"><span className={lab}>KLUCZ API OPENAI {d.has_key && `(ZAPISANY ${d.key_hint})`}</span>
              <input type="password" autoComplete="off" spellCheck={false} className={inp} value={key} onChange={(e) => setKey(e.target.value)}
                placeholder={d.has_key ? "Zostaw puste, żeby nie zmieniać" : "sk-…"} /></label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className={lab}>MODEL</span><input className={inp} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></label>
              <label className="block"><span className={lab}>JAKOŚĆ</span>
                <select className={inp} value={f.quality} onChange={(e) => setF({ ...f, quality: e.target.value })}>
                  <option value="low">Niska (najtaniej, do prób)</option><option value="medium">Średnia</option><option value="high">Wysoka (najdrożej)</option>
                </select></label>
            </div>
            <p className="text-xs text-foreground/50 leading-relaxed">Klucz wklejasz tylko tutaj, nigdy w czacie ani w e-mailu. Ustaw limit wydatków na platform.openai.com → Limits. Jeśli model nie zadziała, wpisz gpt-image-1.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-relic !px-4 !py-2 text-[10px]" disabled={!!busy} onClick={() => save()}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} ZAPISZ</button>
          {d.has_key && <button type="button" className="text-xs text-foreground/50 underline hover:text-[#E8676A]" disabled={!!busy} onClick={() => save({ remove_key: true, provider: "base44" })}>usuń zapisany klucz</button>}
          {msg && <span className="text-xs text-[#9FD3A0]" role="status">{msg}</span>}
          {err && <span className="text-xs text-[#E8676A]" role="alert">{err}</span>}
        </div>
      </div>
    </details>
  );
}
