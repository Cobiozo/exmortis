import React, { useState } from "react";
import { Loader2, Sparkles, Copy, Check, X, CornerLeftUp, UserSquare } from "lucide-react";
import { rz, composePrompt, thumb } from "./rzApi";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-xs text-foreground/85 focus:border-[#C9A24A] focus:outline-none leading-relaxed";
const btn = "inline-flex items-center gap-1.5 border hairline px-3 py-2 technical text-[9px] text-foreground/70 hover:text-[#C9A24A] hover:border-[#C9A24A] disabled:opacity-40";

// Grafika sceny / okładki: opis kadru, „Generuj kadr” (Base44 AI), „Kopiuj prompt” (np. do ChatGPT),
// „Użyj zdjęcia z poprzedniej sceny”. Wygenerowany obraz czeka na zatwierdzenie — nie podmienia obecnego sam.
export default function GenBlock({ kind, id, url, candidate, prompt, story, onSavePrompt, onChanged, allowPrevious }) {
  const [p, setP] = useState(prompt || "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmPrev, setConfirmPrev] = useState(false);
  // Zastąpienie zatwierdzonego zdjęcia obrazem z poprzedniej sceny — tylko po drugim kliknięciu.
  const usePrev = () => {
    if (url && !confirmPrev) { setConfirmPrev(true); return; }
    setConfirmPrev(false);
    act("prev", () => rz("use_previous", { id, replace: !!url }), "Użyto obrazu z poprzedniej sceny.");
  };
  // Zatwierdzony kadr sceny jako wzór postaci (do 3; najstarszy wypada) — używany przy generowaniu przez OpenAI.
  const refs = String(story?.reference_image_url || "").split(/\s+/).filter(Boolean);
  const isRef = !!url && refs.includes(url);
  const addRef = () => act("ref", () => rz("update_story", { id: story.id, fields: { reference_image_url: [...refs, url].slice(-3).join("\n") } }), "Dodano jako wzór postaci.");
  const act = async (name, fn, ok) => {
    setBusy(name); setErr(""); setMsg("");
    try { await fn(); if (ok) setMsg(ok); await onChanged?.(); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(composePrompt(kind, p, story)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr("Nie udało się skopiować — zaznacz opis ręcznie."); }
  };
  return (
    <div className="space-y-2">
      <p className="technical text-[9px] text-foreground/45">OPIS KADRU (PROMPT) — NIE JEST WIDOCZNY DLA CZYTELNIKÓW</p>
      <textarea rows={3} className={inp} value={p} onChange={(e) => setP(e.target.value)} placeholder="Opis zdjęcia po angielsku" />
      <div className="flex flex-wrap gap-2">
        {p !== (prompt || "") && <button type="button" className={btn} disabled={!!busy} onClick={() => act("save", () => onSavePrompt(p), "Zapisano opis.")}>{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} ZAPISZ OPIS</button>}
        <button type="button" className={btn} disabled={!!busy || !p.trim() || p !== (prompt || "")} title={p !== (prompt || "") ? "Najpierw zapisz opis" : ""}
          onClick={() => act("gen", () => rz("generate", { kind, id }), "Gotowe — sprawdź kadr i zatwierdź albo odrzuć.")}>
          {busy === "gen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {busy === "gen" ? "GENERUJĘ… (DO MINUTY)" : "GENERUJ KADR"}
        </button>
        <button type="button" className={btn} onClick={copy} disabled={!p.trim()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "SKOPIOWANO" : "KOPIUJ PROMPT"}</button>
        {allowPrevious && <button type="button" className={`${btn} ${confirmPrev ? "!border-[#E8C547] !text-[#E8C547]" : ""}`} disabled={!!busy} onClick={usePrev} onBlur={() => setConfirmPrev(false)}>
          <CornerLeftUp className="h-3.5 w-3.5" /> {confirmPrev ? "NA PEWNO ZASTĄPIĆ OBECNE ZDJĘCIE?" : "UŻYJ ZDJĘCIA Z POPRZEDNIEJ SCENY"}</button>}
        {kind === "scene" && url && story?.id && !isRef && <button type="button" className={btn} disabled={!!busy} onClick={addRef}><UserSquare className="h-3.5 w-3.5" /> DODAJ JAKO WZÓR POSTACI</button>}
      </div>
      {candidate && (
        <div className="border border-[#C9A24A]/50 p-3 space-y-2">
          <p className="technical text-[9px] gold-text">NOWY KADR CZEKA NA ZATWIERDZENIE</p>
          <img src={thumb(candidate, 960)} alt="" className={`w-full max-w-sm object-cover bg-[#141416] ${kind === "cover_portrait" ? "aspect-[2/3] max-w-[200px]" : "aspect-video"}`} />
          {url && <p className="text-xs text-foreground/50">Zatwierdzenie zastąpi obecny obraz.</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-relic !px-3 !py-2 text-[10px]" disabled={!!busy} onClick={() => act("ok", () => rz("candidate", { kind, id, decision: "accept" }), "Zatwierdzono.")}><Check className="h-3.5 w-3.5" /> ZATWIERDŹ</button>
            <button type="button" className="btn-ghost !px-3 !py-2 text-[10px]" disabled={!!busy} onClick={() => act("no", () => rz("candidate", { kind, id, decision: "reject" }), "Odrzucono.")}><X className="h-3.5 w-3.5" /> ODRZUĆ</button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-[#9FD3A0]" role="status">{msg}</p>}
      {err && <p className="text-xs text-[#E8676A]" role="alert">{err}</p>}
    </div>
  );
}
