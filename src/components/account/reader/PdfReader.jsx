import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Maximize2, Minimize2, Minus, Plus, ChevronUp, ChevronDown } from "lucide-react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5];
const keyFor = (id) => `exm-pdf-page:${id}`;
const readSaved = (id) => { try { return Number(localStorage.getItem(keyFor(id))) || 0; } catch { return 0; } };
const save = (id, n) => { try { localStorage.setItem(keyFor(id), String(n)); } catch { /* bez zapamiętania */ } };

// Jedna strona: rysowana dopiero, gdy jest blisko ekranu (oszczędza pamięć przy długich e-bookach).
function Page({ doc, num, width, ratio, register, root }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const [near, setNear] = useState(false);
  const [h, setH] = useState(Math.round(width * ratio));

  useEffect(() => { register(num, holder.current); }, [num, register]);
  useEffect(() => {
    const el = holder.current;
    const io = new IntersectionObserver((es) => es.forEach((e) => setNear(e.isIntersecting)), { root, rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [num, root]);

  useEffect(() => {
    if (!near || !width) return undefined;
    let task = null;
    let dead = false;
    doc.getPage(num).then((page) => {
      if (dead) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const vp = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(vp.width * dpr);
      c.height = Math.floor(vp.height * dpr);
      c.style.width = `${Math.floor(vp.width)}px`;
      c.style.height = `${Math.floor(vp.height)}px`;
      setH(Math.floor(vp.height));
      task = page.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      task.promise.catch(() => {});
    });
    return () => { dead = true; if (task) task.cancel(); };
  }, [near, width, doc, num]);

  return (
    <div ref={holder} data-page={num} className="relative mx-auto bg-white shadow-[0_6px_30px_rgba(0,0,0,0.45)]" style={{ width, height: h }}>
      {near ? <canvas ref={canvas} className="block" aria-label={`Strona ${num}`} /> : null}
    </div>
  );
}

// Czytnik PDF w przeglądarce: przewijanie stron, powiększenie, pełny ekran, zapamiętana strona, pobieranie.
export default function PdfReader({ src, downloadUrl, storageId, title }) {
  const box = useRef(null);
  const scroller = useRef(null);
  const pages = useRef(new Map());
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [ratio, setRatio] = useState(1.414);
  const [avail, setAvail] = useState(0);
  const [zoomI, setZoomI] = useState(3);
  const [current, setCurrent] = useState(1);
  const [full, setFull] = useState(false);
  const [resume, setResume] = useState(0);
  const [jump, setJump] = useState("");

  useEffect(() => {
    let dead = false;
    let loaded = null;
    setErr(""); setDoc(null);
    const task = pdfjs.getDocument({ url: src, isEvalSupported: false, disableRange: true, disableStream: true, standardFontDataUrl: "/pdfjs/standard_fonts/" });
    task.promise.then(async (d) => {
      loaded = d;
      if (dead) { d.destroy(); return; }
      const p1 = await d.getPage(1);
      const v = p1.getViewport({ scale: 1 });
      setRatio(v.height / v.width);
      setDoc(d);
      const saved = readSaved(storageId);
      if (saved > 1 && saved <= d.numPages) setResume(saved);
    }).catch(() => { if (!dead) setErr("Nie udało się otworzyć e-booka. Odśwież stronę albo pobierz plik."); });
    return () => { dead = true; task.destroy?.(); if (loaded) loaded.destroy(); };
  }, [src, storageId]);

  // Szerokość dostępna na stronę (zmienia się przy obrocie telefonu i pełnym ekranie).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el); setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, [doc, full]);

  const fit = Math.max(260, Math.min(avail - 24, 860));
  const width = Math.round(fit * ZOOMS[zoomI]);

  const register = useCallback((n, el) => { pages.current.set(n, el); }, []);
  // Bieżąca strona: ostatnia, której góra minęła górną krawędź czytnika (na końcu pliku — ostatnia).
  const onScroll = useCallback(() => {
    const sc = scroller.current;
    if (!sc) return;
    let n = 1;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) n = pages.current.size || 1;
    else pages.current.forEach((el, k) => { if (el && el.offsetTop - 12 <= sc.scrollTop + 24 && k > n) n = k; });
    setCurrent((c) => (c === n ? c : n));
    save(storageId, n);
  }, [storageId]);
  const tick = useRef(0);
  const scrolled = () => { cancelAnimationFrame(tick.current); tick.current = requestAnimationFrame(onScroll); };
  const goTo = (n) => {
    const el = pages.current.get(n);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };

  // Po zmianie powiększenia, obrocie ekranu albo pełnym ekranie zostań na tej samej stronie.
  const keep = useRef(current);
  keep.current = current;
  useEffect(() => {
    const n = keep.current;
    const t = setTimeout(() => { const el = pages.current.get(n); if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 12; }, 30);
    return () => clearTimeout(t);
  }, [width]);

  // Pełny ekran: prawdziwy (gdy przeglądarka pozwala) albo rozciągnięcie na całe okno (iPhone).
  useEffect(() => {
    const off = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", off);
    return () => document.removeEventListener("fullscreenchange", off);
  }, []);
  const toggleFull = async () => {
    if (full) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setFull(false);
      return;
    }
    setFull(true);
    if (box.current?.requestFullscreen) await box.current.requestFullscreen().catch(() => {});
  };
  useEffect(() => {
    if (!full) return undefined;
    const esc = (e) => { if (e.key === "Escape") setFull(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [full]);

  const total = doc?.numPages || 0;
  const btn = "inline-flex items-center justify-center h-9 min-w-9 px-2 border hairline text-foreground/80 hover:gold-text hover:border-[#C9A24A]/50 disabled:opacity-40";

  return (
    <div ref={box} className={full ? "fixed inset-0 z-[80] bg-[#0B0B0C] flex flex-col" : "flex flex-col border hairline bg-[#0B0B0C]"}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b hairline bg-[#111113]">
        <p className="technical text-[10px] gold-text truncate max-w-[40%] hidden sm:block" title={title}>{title}</p>
        <div className="flex items-center gap-1 sm:ml-auto">
          <button className={btn} onClick={() => goTo(Math.max(1, current - 1))} disabled={!doc || current <= 1} aria-label="Poprzednia strona"><ChevronUp className="h-4 w-4" /></button>
          <form onSubmit={(e) => { e.preventDefault(); const n = Math.min(total, Math.max(1, parseInt(jump, 10) || current)); setJump(""); goTo(n); }} className="flex items-center gap-1 text-xs text-foreground/70">
            <label htmlFor="pdf-page" className="sr-only">Numer strony</label>
            <input id="pdf-page" inputMode="numeric" value={jump} placeholder={String(current)} onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))} className="w-12 h-9 text-center bg-transparent border hairline text-foreground" />
            <span>/ {total || "…"}</span>
          </form>
          <button className={btn} onClick={() => goTo(Math.min(total, current + 1))} disabled={!doc || current >= total} aria-label="Następna strona"><ChevronDown className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-1 ml-auto sm:ml-2">
          <button className={btn} onClick={() => setZoomI((z) => Math.max(0, z - 1))} disabled={zoomI === 0} aria-label="Pomniejsz"><Minus className="h-4 w-4" /></button>
          <button className={`${btn} text-xs`} onClick={() => setZoomI(3)} aria-label="Dopasuj do szerokości">{Math.round(ZOOMS[zoomI] * 100)}%</button>
          <button className={btn} onClick={() => setZoomI((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomI === ZOOMS.length - 1} aria-label="Powiększ"><Plus className="h-4 w-4" /></button>
          <button className={btn} onClick={toggleFull} aria-label={full ? "Zamknij pełny ekran" : "Pełny ekran"}>{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          {downloadUrl && <a className={btn} href={downloadUrl} rel="noopener" aria-label="Pobierz PDF" title="Pobierz PDF"><Download className="h-4 w-4" /></a>}
        </div>
      </div>
      {resume > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs bg-[#16140E] border-b hairline">
          <span className="text-foreground/75">Ostatnio czytano stronę {resume}.</span>
          <button className="gold-text underline underline-offset-4" onClick={() => { goTo(resume); setResume(0); }}>Wróć do niej</button>
          <button className="text-foreground/55" onClick={() => setResume(0)}>Zacznij od początku</button>
        </div>
      )}
      <div ref={scroller} onScroll={scrolled} className={`overflow-auto ${full ? "flex-1" : "h-[calc(100svh-210px)] min-h-[420px]"}`} style={{ WebkitOverflowScrolling: "touch" }}>
        {err ? (
          <div className="p-8 text-center text-sm text-foreground/70">
            <p>{err}</p>
            {downloadUrl && <a href={downloadUrl} rel="noopener" className="btn-relic !px-5 !py-3 mt-5 inline-flex"><Download className="h-4 w-4" /> Pobierz PDF</a>}
          </div>
        ) : !doc ? (
          <div className="py-24 flex flex-col items-center gap-3 text-xs text-foreground/55"><Loader2 className="h-6 w-6 animate-spin gold-text" />Otwieram e-book…</div>
        ) : (
          <div className="py-3 space-y-3" style={{ minWidth: width + 24 }}>
            {Array.from({ length: total }, (_, i) => (
              <Page key={i + 1} doc={doc} num={i + 1} width={width} ratio={ratio} register={register} root={scroller.current} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
