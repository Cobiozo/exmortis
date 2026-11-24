import React from "react";
import { ExternalLink, Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Image } from "@/components/ui/image";
import GlosPlayer from "./GlosPlayer";
import { hasAudio, ytId } from "./musicUtils";

// Wybrany utwór. Własne audio → okładka i „Słuchaj” (wspólny odtwarzacz, gra dalej między stronami).
// Tylko YouTube → oficjalny odtwarzacz YouTube (zgoda na treści zewnętrzne bez zmian).
export default function MusicNowCard({ song, pos, n, started, live, onStart, onEnded, onListen, onPrev, onNext }) {
  const audio = hasAudio(song);
  const vid = ytId(song);
  const ctrl = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--exm-r-field)] border border-exm-line px-4 text-[14px] text-exm-ivory transition-colors hover:border-exm-gold-line disabled:cursor-not-allowed disabled:opacity-40";
  const eyebrow = live || (!audio && started) ? "Teraz gra" : song.wyrozniony ? "Wyróżniony utwór" : "Utwór";

  return (
    <article id="glos-player" className="min-w-0 scroll-mt-[calc(var(--exm-header-h,72px)+12px)] overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface lg:sticky lg:top-[calc(var(--exm-header-h,72px)+16px)]">
      {audio ? (
        <div className="flex gap-4 p-5 md:gap-5 md:p-6">
          {song.okladka ? <Image src={song.okladka} alt={song.tytul} className="aspect-square w-24 shrink-0 rounded-[var(--exm-r-field)] bg-exm-surface-2 md:w-40" />
            : <span className="grid aspect-square w-24 shrink-0 place-items-center rounded-[var(--exm-r-field)] bg-exm-surface-2 md:w-40"><Music className="h-8 w-8 text-exm-gold" aria-hidden="true" /></span>}
          <Head song={song} eyebrow={eyebrow} pos={pos} n={n} />
        </div>
      ) : (
        <>
          <div className="bg-exm-surface-2 p-3 md:p-4">
            <GlosPlayer videoId={vid} started={started} onStart={onStart} onEnded={onEnded} />
          </div>
          <div className="px-5 pt-5 md:px-6"><Head song={song} eyebrow={eyebrow} pos={pos} n={n} /></div>
        </>
      )}
      <div className="flex flex-col gap-3 px-5 pb-5 md:px-6 md:pb-6">
        {song.opis && <p className="line-clamp-3 max-w-[62ch] text-[15px] leading-relaxed text-exm-muted">{song.opis}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={ctrl} onClick={onPrev} disabled={pos <= 1}><SkipBack className="h-4 w-4" aria-hidden="true" /> Poprzedni</button>
          {audio ? (
            <button type="button" className="btn-relic !min-h-11 !px-5 text-[14px]" onClick={onListen}>
              {live ? <><Pause className="h-4 w-4" aria-hidden="true" /> Wstrzymaj</> : <><Play className="h-4 w-4" aria-hidden="true" /> Słuchaj</>}
            </button>
          ) : !started && (
            <button type="button" className="btn-relic !min-h-11 !px-5 text-[14px]" onClick={onStart}><Play className="h-4 w-4" aria-hidden="true" /> Obejrzyj</button>
          )}
          <button type="button" className={ctrl} onClick={onNext} disabled={pos >= n}>Następny <SkipForward className="h-4 w-4" aria-hidden="true" /></button>
          {audio && vid && (
            <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noreferrer" className="btn-link">Obejrzyj na YouTube <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
          )}
        </div>
        {song.tekst?.trim() && (
          <details className="rounded-[var(--exm-r-field)] border border-exm-line px-4 py-3">
            <summary className="cursor-pointer text-[14px] font-medium text-exm-ivory">Tekst utworu</summary>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-exm-muted">{song.tekst}</p>
          </details>
        )}
      </div>
    </article>
  );
}

function Head({ song, eyebrow, pos, n }) {
  return (
    <div className="min-w-0">
      <p className="exm-eyebrow">{eyebrow} · {pos} z {n}</p>
      <h3 className="mt-2 font-exm-serif text-[clamp(1.35rem,2.6vw,1.85rem)] leading-[1.15] text-exm-ivory">{song.tytul}</h3>
      <p className="mt-1 text-[13px] text-exm-muted">{[song.autor || "EXMORTIS", song.kategoria].filter(Boolean).join(" · ")}</p>
    </div>
  );
}