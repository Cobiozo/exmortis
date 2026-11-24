import React from "react";
import { RotateCcw, RotateCw, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { usePodcastPlayer } from "./PlayerContext";
import { isMusic } from "./playerStore";
import { fmtT } from "./podcastUtils";
import PlayerQueue from "./PlayerQueue";

const RATES = [0.8, 1, 1.25, 1.5, 2];
// iOS nie pozwala stronie zmieniać głośności — tam suwak jest ukryty (głośność z przycisków telefonu).
const canVolume = typeof navigator !== "undefined" && !/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Rozwinięta belka: czas, przewijanie, poprzednie/następne, prędkość (podcast), głośność i kolejka.
export default function PlayerPanel() {
  const p = usePodcastPlayer();
  const music = isMusic(p.ep);
  const btn = "grid h-11 w-11 place-items-center rounded-full text-exm-ivory hover:text-exm-gold disabled:opacity-30";
  return (
    <div className="max-h-[60vh] overflow-y-auto border-b border-exm-line">
      <div className="mx-auto max-w-[var(--exm-container)] space-y-4 px-4 py-4 sm:px-[var(--exm-pad)]">
        <div>
          <input type="range" min={0} max={p.dur || 1} step={1} value={Math.min(p.t, p.dur || 1)} disabled={!p.dur}
            onChange={(e) => p.seek(Number(e.target.value))} aria-label="Przewiń nagranie" className="w-full accent-[#C9A24A]" />
          <div className="mt-1 flex justify-between font-mono text-[12px] text-exm-muted digits">
            <span>{fmtT(p.t)}</span><span>{p.dur ? fmtT(p.dur) : "--:--"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <div className="flex items-center gap-1">
            <button type="button" onClick={p.prev} disabled={!p.hasPrev && !p.t} aria-label="Poprzednie nagranie" className={btn}><SkipBack className="h-5 w-5" /></button>
            {!music && <button type="button" onClick={() => p.skip(-15)} aria-label="15 sekund wstecz" className={btn}><RotateCcw className="h-5 w-5" /></button>}
            {!music && <button type="button" onClick={() => p.skip(30)} aria-label="30 sekund naprzód" className={btn}><RotateCw className="h-5 w-5" /></button>}
            <button type="button" onClick={p.next} disabled={!p.hasNext} aria-label="Następne nagranie" className={btn}><SkipForward className="h-5 w-5" /></button>
          </div>
          {!music && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prędkość odtwarzania">
              {RATES.map((r) => (
                <button key={r} type="button" onClick={() => p.setRate(r)} aria-pressed={p.rate === r}
                  className={`min-h-[32px] rounded-full border px-3 text-[12px] ${p.rate === r ? "border-exm-gold text-exm-gold" : "border-exm-line text-exm-muted hover:text-exm-ivory"}`}>
                  {String(r).replace(".", ",")}×
                </button>
              ))}
            </div>
          )}
          {canVolume && (
            <label className="flex items-center gap-2 text-exm-muted">
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => p.setVolume(Number(e.target.value))}
                aria-label="Głośność" className="w-28 accent-[#C9A24A]" />
            </label>
          )}
        </div>
        <PlayerQueue />
      </div>
    </div>
  );
}