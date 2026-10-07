import React, { useState } from "react";
import { Volume2, VolumeX, Timer, Image as ImageIcon, Pause, Play, Square, Maximize2, Minimize2 } from "lucide-react";
import BackdropPicker from "./backdrop/BackdropPicker";
import ViewSwitch from "./ViewSwitch";
import { isIOS } from "./audioEngine";

const btn = "h-11 w-11 flex items-center justify-center text-[#F5EFE1]/70 hover:text-[#C9A24A] transition-colors disabled:opacity-30";
const ico = "h-5 w-5";
const box = "border border-[#C9A24A]/30 bg-[#0A0A0B] px-4 py-3 max-w-[calc(100vw-2rem)]";

// Głośnik · Widok · Tło · Pełny ekran · Pauza · Zakończ — w strefie na dole, chowa się po 4 s.
export default function CiszaControls({ visible, muted, onMute, volume, onVolume, view, onView, backdrops, backdropId, onBackdrop, paused, onPause, canPause, onEnd, full, onFull }) {
  const [panel, setPanel] = useState(null);
  const ios = isIOS();
  const toggle = (p) => setPanel((c) => (c === p ? null : p));
  const Vol = muted ? VolumeX : Volume2;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 px-4 pb-2 transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}>
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2">
        {panel === "vol" && !ios && (
          <div className={`${box} flex items-center gap-3`}>
            <button onClick={onMute} className={btn} aria-label={muted ? "Włącz sygnały" : "Wycisz sygnały"}><Vol className={ico} strokeWidth={1.25} /></button>
            <input type="range" min="0" max="100" value={volume} aria-label="Głośność sygnałów" onChange={(e) => onVolume(Number(e.target.value))} className="w-32 accent-[#C9A24A]" />
          </div>
        )}
        {panel === "view" && <div className={box}><ViewSwitch value={view} onChange={(v) => { onView(v); setPanel(null); }} /></div>}
        {panel === "img" && <div className={box}><BackdropPicker items={backdrops} value={backdropId} onChange={onBackdrop} /></div>}
      </div>
      <div className="flex items-center max-w-full border border-[#C9A24A]/20 bg-[#0A0A0B]/80 px-1">
        <button onClick={() => (ios ? onMute() : toggle("vol"))} className={btn} aria-label={muted ? "Sygnały wyciszone" : "Sygnały włączone"}><Vol className={ico} strokeWidth={1.25} /></button>
        <button onClick={() => toggle("view")} className={btn} aria-label="Widok"><Timer className={ico} strokeWidth={1.25} /></button>
        {backdrops.length > 1 && <button onClick={() => toggle("img")} className={btn} aria-label="Tło"><ImageIcon className={ico} strokeWidth={1.25} /></button>}
        <button onClick={onFull} className={btn} aria-label={full ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}>{full ? <Minimize2 className={ico} strokeWidth={1.25} /> : <Maximize2 className={ico} strokeWidth={1.25} />}</button>
        <button onClick={onPause} disabled={!canPause} className={btn} aria-label={paused ? "Wznów" : "Pauza"}>{paused ? <Play className={ico} strokeWidth={1.25} /> : <Pause className={ico} strokeWidth={1.25} />}</button>
        <button onClick={onEnd} className={btn} aria-label="Zakończ"><Square className={ico} strokeWidth={1.25} /></button>
      </div>
    </div>
  );
}