import React, { useState } from "react";
import { Volume2, VolumeX, Music, Pause, Play, X, Sun, Circle, Timer, Moon, Maximize2, Minimize2, Image as ImageIcon } from "lucide-react";
import BackdropPicker from "./backdrop/BackdropPicker";
import BgList from "./BgList";
import ViewPicker from "./ViewPicker";
import { isIOS } from "./audioEngine";

const ico = "h-5 w-5";
const btn = "p-3 text-[#C9A24A] hover:text-[#E2C170] disabled:opacity-30 disabled:cursor-not-allowed";

// Dyskretny pasek sterowania na dole ekranu.
export default function CiszaControls({
  visible, reduced, hasSound, muted, onMute, volume, onVolume, tracks, bgId, onBg,
  paused, onPause, onEnd, canPause, wake, onWake,
  view, onView, showTime, onShowTime, dim, onDim, full, onFull,
  backdrops, backdropId, onBackdrop, match, onMatch,
}) {
  const [panel, setPanel] = useState(null);
  const ios = isIOS();
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const toggle = (p) => setPanel((c) => (c === p ? null : p));

  const slider = ios ? (
    <span className="text-xs text-foreground/45">Głośność ustawisz przyciskami telefonu</span>
  ) : (
    <input
      type="range" min="0" max="100" value={volume} aria-label="Głośność"
      onChange={(e) => onVolume(Number(e.target.value))}
      className="w-32 accent-[#C9A24A]"
    />
  );

  return (
    <div
      className="absolute bottom-0 inset-x-0 pb-[max(1rem,env(safe-area-inset-bottom))] px-4 flex flex-col items-center gap-3 transition-opacity"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transitionDuration: reduced ? "0ms" : "700ms" }}
    >
      {full ? (
        <button onClick={onFull} className={btn} aria-label="Wyjdź z pełnego ekranu">
          <Minimize2 className={ico} strokeWidth={1.25} />
        </button>
      ) : (<>
      {panel === "view" && (
        <div className="border border-[#C9A24A]/30 bg-[#0A0A0B] px-4 py-3">
          <ViewPicker value={view} onChange={(v) => { onView(v); setPanel(null); }} reduced={reduced} />
        </div>
      )}
      {panel === "img" && (
        <div className="border border-[#C9A24A]/30 bg-[#0A0A0B] px-4 py-3">
          <BackdropPicker items={backdrops} value={backdropId} onChange={onBackdrop} match={match} onMatch={onMatch} />
        </div>
      )}
      {panel === "bg" && <BgList tracks={tracks} value={bgId} onChange={(id) => { onBg(id); setPanel(null); }} />}
      {panel === "vol" && (
        <div className="flex items-center gap-3 border border-[#C9A24A]/30 bg-[#0A0A0B] px-4 py-3">
          <button onClick={onMute} className={btn} aria-label={muted ? "Włącz dźwięk" : "Wycisz dźwięk"}>
            {muted ? <VolumeX className={ico} strokeWidth={1.25} /> : <Volume2 className={ico} strokeWidth={1.25} />}
          </button>
          {slider}
        </div>
      )}
      <div className="flex flex-wrap justify-center items-center max-w-full border border-[#C9A24A]/20 bg-[#0A0A0B]/80 px-2">
        <button
          disabled={!hasSound}
          title={hasSound ? undefined : "Dla tego czasu nie ma jeszcze dźwięku"}
          onClick={() => (coarse ? toggle("vol") : onMute())}
          className={btn}
          aria-label={!hasSound ? "Dla tego czasu nie ma jeszcze dźwięku" : muted ? "Włącz dźwięk" : "Wycisz dźwięk"}
        >
          {muted || !hasSound ? <VolumeX className={ico} strokeWidth={1.25} /> : <Volume2 className={ico} strokeWidth={1.25} />}
        </button>
        {hasSound && !coarse && <span className="hidden md:inline-flex pr-2">{slider}</span>}
        <button disabled={!hasSound} onClick={() => toggle("bg")} className={btn} aria-label="Zmień dźwięk">
          <Music className={ico} strokeWidth={1.25} />
        </button>
        <button onClick={() => toggle("img")} className={btn} aria-label="Zmień tło" aria-expanded={panel === "img"}>
          <ImageIcon className={ico} strokeWidth={1.25} />
        </button>
        <button onClick={() => toggle("view")} className={btn} aria-label="Zmień widok odliczania" aria-expanded={panel === "view"}>
          <Circle className={ico} strokeWidth={1.25} />
        </button>
        <button onClick={onShowTime} disabled={view === "cyfry"} className={`${btn} ${showTime ? "" : "opacity-50"}`} aria-pressed={showTime} aria-label="Pokaż czas">
          <Timer className={ico} strokeWidth={1.25} />
        </button>
        <button onClick={onDim} className={`${btn} ${dim ? "" : "opacity-50"}`} aria-pressed={dim} aria-label="Przygaś ekran">
          <Moon className={ico} strokeWidth={1.25} />
        </button>
        <button onClick={onFull} className={btn} aria-label="Pełny ekran">
          <Maximize2 className={ico} strokeWidth={1.25} />
        </button>
        {"wakeLock" in navigator && (
          <button onClick={onWake} className={`${btn} ${wake ? "" : "opacity-40"}`} aria-pressed={wake} aria-label="Nie wygaszaj ekranu">
            <Sun className={ico} strokeWidth={1.25} />
          </button>
        )}
        <button disabled={!canPause} onClick={onPause} className={btn} aria-label={paused ? "Wznów" : "Pauza"}>
          {paused ? <Play className={ico} strokeWidth={1.25} /> : <Pause className={ico} strokeWidth={1.25} />}
        </button>
        <button onClick={onEnd} className={btn} aria-label="Zakończ">
          <X className={ico} strokeWidth={1.25} />
        </button>
      </div>
      {!hasSound && <p className="text-xs text-foreground/35">Dla tego czasu nie ma jeszcze dźwięku</p>}
      </>)}
    </div>
  );
}