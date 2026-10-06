import React, { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// Odsłuch pliku z paskiem postępu.
export default function AudioPreview({ url }) {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-2 flex-1 min-w-[110px]">
      <button
        onClick={() => (ref.current.paused ? ref.current.play() : ref.current.pause())}
        className="text-[#C9A24A] p-1" aria-label={on ? "Zatrzymaj odsłuch" : "Odsłuchaj"}
      >
        {on ? <Pause className="h-4 w-4" strokeWidth={1.25} /> : <Play className="h-4 w-4" strokeWidth={1.25} />}
      </button>
      <div className="h-[3px] bg-foreground/15 flex-1 relative">
        <div className="absolute inset-y-0 left-0 bg-[#C9A24A]" style={{ width: `${p * 100}%` }} />
      </div>
      <audio
        ref={ref} src={url} preload="none"
        onPlay={() => setOn(true)} onPause={() => setOn(false)}
        onEnded={() => { setOn(false); setP(0); }}
        onTimeUpdate={(e) => setP(e.target.currentTime / (e.target.duration || 1))}
      />
    </div>
  );
}