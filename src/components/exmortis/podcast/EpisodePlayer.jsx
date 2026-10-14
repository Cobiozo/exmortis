import React from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { usePodcastPlayer, savedPos } from "./PlayerContext";
import { fmtT } from "./podcastUtils";

const RATES = [0.8, 1, 1.25, 1.5, 2];

// Odtwarzacz pliku: prędkość 0.8–2×, ±15 s / ±30 s, pasek, „Kontynuuj od”.
export default function EpisodePlayer({ ep, startAt }) {
  const p = usePodcastPlayer();
  const mine = p.ep?.id === ep.id;
  const t = mine ? p.t : 0;
  const dur = (mine && p.dur) || ep.dlugosc_s || 0;
  const resume = !mine && savedPos(ep.id) > 30 ? savedPos(ep.id) : 0;
  const btn = "p-2 text-[#C9A24A] hover:text-[#E2C170]";

  return (
    <div className="border hairline p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => (mine ? p.toggle() : p.play(ep, startAt || 0))} className="h-14 w-14 shrink-0 bg-[#C9A24A] text-[#0A0A0B] flex items-center justify-center" aria-label={mine && p.playing ? "Pauza" : "Słuchaj"}>
          {mine && p.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        <button disabled={!mine} onClick={() => p.skip(-15)} className={btn} aria-label="Cofnij 15 s"><RotateCcw className="h-5 w-5" /></button>
        <button disabled={!mine} onClick={() => p.skip(30)} className={btn} aria-label="Dalej 30 s"><RotateCw className="h-5 w-5" /></button>
        <span className="ml-auto font-mono text-xs text-foreground/55">{fmtT(t)} / {fmtT(dur)}</span>
      </div>
      <input type="range" min="0" max={dur || 1} value={t} disabled={!mine} onChange={(e) => p.seek(Number(e.target.value))} className="w-full accent-[#C9A24A]" aria-label="Postęp" />
      <div className="flex flex-wrap items-center gap-2">
        {RATES.map((r) => (
          <button key={r} onClick={() => p.setRate(r)} className={`technical text-[10px] px-2 py-1 border ${p.rate === r ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55"}`}>{r}×</button>
        ))}
        {resume > 0 && <button onClick={() => p.play(ep, resume)} className="ml-auto text-xs gold-text underline">Kontynuuj od {fmtT(resume)}</button>}
      </div>
    </div>
  );
}