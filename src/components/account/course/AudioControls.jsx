import React from "react";
import { Play, Pause, RotateCcw, RotateCw, Loader2 } from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export const fmt = (s) => {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// Sterowanie nagraniem: odtwarzaj/pauza, 15 s wstecz, 30 s naprzód, pasek przewijania, prędkość.
export default function AudioControls({ playing, loading, time, duration, speed, onToggle, onSeek, onSkip, onSpeed }) {
  const max = duration || 0;
  const pct = max ? (time / max) * 100 : 0;
  return (
    <div className="space-y-5">
      <div>
        <input
          type="range" min={0} max={max || 1} step={1} value={Math.min(time, max || 1)}
          onChange={(e) => onSeek(Number(e.target.value))} disabled={!max} aria-label="Przewiń nagranie"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#C9A24A]"
          style={{ background: `linear-gradient(to right, #C9A24A ${pct}%, rgba(255,255,255,0.12) ${pct}%)` }}
        />
        <div className="mt-2 flex justify-between font-mono text-[12px] text-exm-muted digits">
          <span>{fmt(time)}</span><span>{max ? `-${fmt(max - time)}` : "--:--"}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 sm:gap-8">
        <button type="button" onClick={() => onSkip(-15)} aria-label="15 sekund wstecz" className="relative grid h-12 w-12 place-items-center rounded-full text-exm-ivory hover:text-exm-gold">
          <RotateCcw className="h-6 w-6" strokeWidth={1.5} /><span className="absolute text-[9px] font-semibold">15</span>
        </button>
        <button type="button" onClick={onToggle} aria-label={playing ? "Pauza" : "Odtwarzaj"}
          className="grid h-16 w-16 place-items-center rounded-full bg-exm-gold text-exm-bg transition-colors hover:bg-exm-gold-hover">
          {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : playing ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
        </button>
        <button type="button" onClick={() => onSkip(30)} aria-label="30 sekund naprzód" className="relative grid h-12 w-12 place-items-center rounded-full text-exm-ivory hover:text-exm-gold">
          <RotateCw className="h-6 w-6" strokeWidth={1.5} /><span className="absolute text-[9px] font-semibold">30</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Prędkość odtwarzania">
        {SPEEDS.map((s) => (
          <button key={s} type="button" onClick={() => onSpeed(s)} aria-pressed={speed === s}
            className={`min-h-[32px] rounded-full border px-3 text-[12px] ${speed === s ? "border-exm-gold text-exm-gold" : "border-exm-line text-exm-muted hover:text-exm-ivory"}`}>
            {String(s).replace(".", ",")}×
          </button>
        ))}
      </div>
    </div>
  );
}