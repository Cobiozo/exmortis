import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Loader2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { Image } from "@/components/ui/image";
import { usePodcastPlayer, subtitleOf } from "./PlayerContext";
import { kindOf } from "./playerStore";
import PlayerPanel from "./PlayerPanel";

// Globalna belka odtwarzacza. Stoi nad innymi dolnymi paskami (zakup, zapis) — te ustawiają --exm-bottom-bar.
// Wysokość belki trafia do --exm-player-h: strona dostaje dolny odstęp, a „Nagła pomoc” unosi się nad nią.
export default function MiniPlayer() {
  const p = usePodcastPlayer();
  const [open, setOpen] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--exm-player-h", `${el?.offsetHeight || 0}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (el) ro?.observe(el);
    return () => { ro?.disconnect(); root.style.setProperty("--exm-player-h", "0px"); };
  }, []);

  const ep = p.ep;
  const pct = p.dur ? Math.min(100, (p.t / p.dur) * 100) : 0;
  const href = ep.href || (kindOf(ep) === "utwor" ? "/glos#muzyka" : `/glos/${ep.slug}`);
  const icon = "grid h-11 w-11 shrink-0 place-items-center rounded-full text-exm-ivory hover:text-exm-gold disabled:opacity-30";
  const label = p.error ? "Spróbuj ponownie" : p.restored ? "Wznów" : p.playing ? "Wstrzymaj" : "Odtwórz";

  return (
    <div
      role="region" aria-label="Odtwarzacz Głosu" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className="fixed inset-x-0 z-50 border-t border-exm-gold-line bg-exm-bg/95 backdrop-blur"
      style={{ bottom: "var(--exm-bottom-bar, 0px)", paddingBottom: "max(0px, calc(env(safe-area-inset-bottom) - var(--exm-bottom-bar, 0px)))" }}
    >
      {open && <PlayerPanel onClose={() => setOpen(false)} />}
      <div ref={rowRef}>
        <div className="h-0.5 bg-exm-line"><div className="h-full bg-exm-gold" style={{ width: `${pct}%` }} /></div>
        <div className="mx-auto flex max-w-[var(--exm-container)] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-[var(--exm-pad)]">
          {ep.okladka && <Image src={ep.okladka} alt="" className="h-11 w-11 shrink-0 rounded-md" />}
          <div className="min-w-0 flex-1">
            <Link to={href} className="block truncate text-[14px] font-medium text-exm-ivory hover:text-exm-gold">{ep.tytul}</Link>
            <p className="truncate text-[12px] text-exm-muted" aria-live="polite">
              {p.error ? <span className="text-exm-error">Nie udało się wczytać nagrania</span>
                : p.restored ? "Wstrzymane · możesz wznowić"
                : p.playing ? <><span className="text-exm-gold">Teraz gra</span> · {subtitleOf(ep)}</> : subtitleOf(ep)}
            </p>
          </div>
          <button type="button" onClick={p.prev} disabled={!p.hasPrev && !p.t} aria-label="Poprzednie nagranie" className={`${icon} hidden sm:grid`}><SkipBack className="h-5 w-5" /></button>
          {p.error ? (
            <button type="button" onClick={p.retry} className="btn-ghost !min-h-[40px] !px-3 text-[13px]">Spróbuj ponownie</button>
          ) : (
            <button type="button" onClick={p.toggle} aria-label={label}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-exm-gold text-exm-bg hover:bg-exm-gold-hover">
              {p.buffering && !p.restored ? <Loader2 className="h-5 w-5 animate-spin" /> : p.playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
            </button>
          )}
          <button type="button" onClick={p.next} disabled={!p.hasNext} aria-label="Następne nagranie" className={`${icon} hidden sm:grid`}><SkipForward className="h-5 w-5" /></button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Zwiń odtwarzacz" : "Rozwiń odtwarzacz"} className={icon}>
            {open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
          <button type="button" onClick={p.close} aria-label="Zamknij odtwarzacz" className={`${icon} text-exm-muted`}><X className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}