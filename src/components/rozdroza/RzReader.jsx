import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Undo2, Image as ImageIcon, ImageOff, Minus, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { loadStory, loadPreview } from "./api";
import * as E from "./engine";
import RzImage, { prefetchImages } from "./RzImage";
import RzProblem from "./RzProblem";
import "./rozdroza.css";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const HTML_RE = /<\/?(p|br|em|strong|i|b|blockquote|span)\b/i;

// Tekst sceny: bez zmian treści. Zwykły tekst → akapity (pusta linia) i złamania wiersza; HTML z edytora → oczyszczony.
function Body({ text, className }) {
  if (!text) return null;
  if (HTML_RE.test(text)) return <div className={`rz-body ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />;
  const paras = String(text).split(/\n\s*\n/);
  return (
    <div className={`rz-body ${className}`}>
      {paras.map((p, i) => <p key={i}>{p.split("\n").map((l, j, a) => <React.Fragment key={j}>{l}{j < a.length - 1 && <br />}</React.Fragment>)}</p>)}
    </div>
  );
}

// Czytnik: cała historia w pamięci po jednym pobraniu; przejścia między scenami bez zapytań do serwera.
export default function RzReader({ previewId = null }) {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const uid = user?.id || user?.email;
  const [data, setData] = useState(null);       // { meta, snapshot, offline?, preview? }
  const [err, setErr] = useState("");
  const [st, setSt] = useState(null);
  const [note, setNote] = useState("");         // komunikat o zmianie wersji itp.
  const [incompatible, setIncompatible] = useState(false);
  const [prefs, setPrefs] = useState(() => E.readPrefs(uid));
  const [saveOk, setSaveOk] = useState(true);
  const lock = useRef(false);
  const head = useRef(null);
  const top = useRef(null);
  const first = useRef(true);

  const open = useCallback(() => {
    setErr(""); setData(null); setSt(null); setIncompatible(false); setNote("");
    (previewId ? loadPreview(previewId) : loadStory(slug)).then((d) => {
      const bad = E.checkSnapshot(d.snapshot);
      if (bad) { setErr(`${bad} Spróbuj później albo wybierz inną historię.`); return; }
      setData(d);
      if (d.preview) { setSt(E.initState(d.snapshot)); return; }
      const saved = E.readProgress(uid, d.meta.id);
      const r = E.restore(d.snapshot, saved);
      if (r.state) { setSt(r.state); if (r.migrated) setNote("Historia została zaktualizowana — wracasz do miejsca, w którym skończyła się lektura."); }
      else if (r.incompatible) { setIncompatible(true); setSt(null); }
      else setSt(E.initState(d.snapshot));
      if (d.offline) setNote("Brak połączenia — czytasz zapisaną kopię tej historii.");
    }).catch((e) => setErr(e.message));
  }, [slug, previewId, uid]);
  useEffect(open, [open]);

  const snap = data?.snapshot;
  const scene = st && snap ? E.sceneOf(snap, st.scene) : null;

  // Zapis postępu po każdej zmianie sceny (nie w podglądzie administratora).
  useEffect(() => {
    if (!st || !data || data.preview || st.error) return;
    setSaveOk(E.writeProgress(uid, data.meta.id, snap.v, st));
  }, [st, data, uid, snap]);

  // Nowa scena: na górę czytnika, fokus na tytule (czytniki ekranu), wstępne pobranie 1–2 kolejnych kadrów.
  useEffect(() => {
    if (!scene) return;
    if (!first.current) {
      top.current?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
      head.current?.focus({ preventScroll: true });
    }
    first.current = false;
    if (prefs.images) prefetchImages(E.targets(snap, st.scene).map((k) => E.sceneOf(snap, k)?.i));
  }, [st?.scene, st?.stack?.length]);

  useEffect(() => { E.writePrefs(uid, prefs); }, [prefs, uid]);

  // Każde przejście najwyżej raz na 300 ms — szybkie podwójne kliknięcie nie wykona wyboru dwa razy.
  const act = (fn) => {
    if (lock.current) return;
    lock.current = true;
    setSt((s) => fn(snap, s));
    setTimeout(() => { lock.current = false; }, 300);
  };
  const restart = () => { if (!data.preview) E.clearProgress(uid, data.meta.id); setIncompatible(false); setNote(""); setSt(E.initState(snap)); };

  const fontStep = (d) => setPrefs((p) => {
    const i = E.FONT_STEPS.indexOf(p.font);
    return { ...p, font: E.FONT_STEPS[Math.max(0, Math.min(E.FONT_STEPS.length - 1, (i < 0 ? 1 : i) + d))] };
  });

  const lastDec = useMemo(() => (st ? E.lastDecision(st) : null), [st]);

  if (err) return <RzProblem text={err} onRetry={open} />;
  if (!data) return (
    <div className="max-w-[720px] mx-auto" aria-busy="true">
      <div className="h-11 mb-6" />
      <div className="aspect-video bg-[#141416] animate-pulse motion-reduce:animate-none" />
      <div className="h-8 w-2/3 bg-[#141416] mt-8" /><div className="h-4 w-full bg-[#141416] mt-6" /><div className="h-4 w-5/6 bg-[#141416] mt-3" />
    </div>
  );
  if (incompatible) return (
    <RzProblem text="Ta historia została zmieniona i nie da się bezpiecznie wrócić do zapisanego miejsca. Możesz zacząć ją od nowa."
      extra={<button type="button" onClick={restart} className="btn-relic">ZACZNIJ OD NOWA</button>} />
  );
  if (!st || !scene || st.error) return (
    <RzProblem text={st?.error ? "W tej historii brakuje kolejnej sceny. Możesz wrócić do poprzedniej sceny albo do biblioteki." : "Nie udało się otworzyć sceny."}
      extra={st?.error ? <button type="button" onClick={() => setSt((s) => { const { error, ...rest } = s; void error; return rest; })} className="btn-relic">WRÓĆ DO SCENY</button> : <button type="button" onClick={restart} className="btn-relic">OD POCZĄTKU</button>} />
  );

  const libraryHref = data.preview ? "/admin/rozdroza" : "/konto/rozdroza/biblioteka";
  const ctrl = "h-11 min-w-[44px] px-2.5 inline-flex items-center justify-center gap-1.5 border hairline text-foreground/70 hover:text-foreground hover:border-[#C9A24A]/60 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60";

  return (
    <div className="rz-reader max-w-[720px] mx-auto" style={{ "--rz-font": prefs.font }}>
      <div ref={top} className="scroll-mt-28" />
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link to={libraryHref} className="technical text-[10px] text-foreground/55 hover:text-foreground inline-flex items-center gap-2 min-h-[44px] min-w-0">
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{data.preview ? "PANEL" : "BIBLIOTEKA"}</span>
        </Link>
        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Ustawienia czytnika">
          <button type="button" className={ctrl} onClick={() => act(E.back)} disabled={st.stack.length < 2} aria-label="Cofnij do poprzedniej sceny"><Undo2 className="h-4 w-4" /><span className="hidden sm:inline technical text-[10px]">COFNIJ</span></button>
          <button type="button" className={ctrl} onClick={() => fontStep(-1)} disabled={prefs.font === E.FONT_STEPS[0]} aria-label="Mniejszy tekst"><Minus className="h-3.5 w-3.5" /><span className="text-xs">A</span></button>
          <button type="button" className={ctrl} onClick={() => fontStep(1)} disabled={prefs.font === E.FONT_STEPS[E.FONT_STEPS.length - 1]} aria-label="Większy tekst"><Plus className="h-3.5 w-3.5" /><span className="text-base">A</span></button>
          <button type="button" className={ctrl} onClick={() => setPrefs((p) => ({ ...p, images: !p.images }))} aria-pressed={!prefs.images} aria-label={prefs.images ? "Ukryj obrazy" : "Pokaż obrazy"}>
            {prefs.images ? <ImageOff className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {(note || data.preview || !saveOk) && (
        <p className="text-xs text-[#E8C547] border border-[#E8C547]/30 px-3 py-2 mb-6" role="status">
          {data.preview ? "PODGLĄD SZKICU (tylko administrator) — postęp nie jest zapisywany." : !saveOk ? "Postęp nie zapisuje się w tej przeglądarce — możesz czytać dalej w tej sesji." : note}
        </p>
      )}

      <div key={`${st.scene}-${st.stack.length}`} className="motion-safe:animate-[rzIn_.35s_ease-out]">
        {prefs.images && scene.i && <RzImage url={scene.i} alt={scene.a || ""} eager className="border hairline mb-8" />}
        {scene.y === "ending" && <p className="technical text-[10px] text-[#E8676A] mb-2">ZAKOŃCZENIE</p>}
        {scene.t && <h1 ref={head} tabIndex={-1} className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] leading-tight outline-none">{scene.t}</h1>}
        {!scene.t && <span ref={head} tabIndex={-1} className="sr-only">Scena</span>}
        <Body text={scene.b} className="mt-6 text-foreground/85" />

        {scene.y === "narrative" && (
          <button type="button" onClick={() => act(E.next)} className="btn-relic mt-10 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60">DALEJ <ArrowRight className="h-4 w-4" /></button>
        )}

        {scene.y === "decision" && (
          <div className="mt-10 grid gap-3" role="group" aria-label="Twoja decyzja">
            {(scene.c || []).map((c, i) => {
              const was = st.previous?.at === st.scene && st.previous.idx === i;
              return (
                <button key={i} type="button" onClick={() => act((s, x) => E.choose(s, x, i))}
                  className="text-left w-full border border-[#C9A24A]/50 hover:border-[#C9A24A] hover:bg-[#C9A24A]/[0.06] px-5 py-4 min-h-[56px] text-[#F5EFE1] leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24A]/70"
                  style={{ fontSize: "calc(1.05rem * var(--rz-font, 1))" }}>
                  {c.l}
                  {was && <span className="block technical text-[9px] text-foreground/45 mt-2">TĘ DROGĘ WYBRANO POPRZEDNIO</span>}
                </button>
              );
            })}
          </div>
        )}

        {scene.y === "ending" && (
          <>
            {scene.q && (
              <blockquote className="mt-10 border-l-2 border-[#C9A24A] pl-5 py-1">
                <p className="technical text-[10px] gold-text mb-2">PYTANIE NA DROGĘ</p>
                <p className="shop-heading italic text-2xl text-[#F5EFE1]/90 leading-snug">{scene.q}</p>
              </blockquote>
            )}
            <div className="mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
              {lastDec && <button type="button" onClick={() => act(E.otherPath)} className="btn-relic focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60">ZOBACZ INNĄ DROGĘ</button>}
              <button type="button" onClick={restart} className="btn-ghost">PRZEJDŹ PONOWNIE</button>
              <button type="button" onClick={() => nav(libraryHref)} className="btn-ghost">WRÓĆ DO BIBLIOTEKI</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
