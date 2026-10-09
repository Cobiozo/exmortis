import React, { useEffect, useRef, useState } from "react";

// Wideo z prywatnego pliku: bez pobierania, wznowienie od miejsca, „Tylko dźwięk”.
export default function ObokVideo({ n, poster, onSave }) {
  const v = useRef(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const last = useRef(0);
  useEffect(() => { const el = v.current; const go = () => { if (n.pozycja_s) el.currentTime = n.pozycja_s; }; el.addEventListener("loadedmetadata", go, { once: true }); return () => onSave(Math.floor(el.currentTime)); }, []);
  const tick = (e) => { const t = e.currentTarget.currentTime; if (Math.abs(t - last.current) >= 15) { last.current = t; onSave(Math.floor(t)); } };
  return (
    <div>
      <div className={audioOnly ? "h-0 overflow-hidden" : ""}>
        <video ref={v} src={n.src} poster={poster || undefined} controls playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture
          onTimeUpdate={tick} onEnded={(e) => onSave(Math.floor(e.currentTarget.duration), true)} className="w-full bg-black" />
      </div>
      <button onClick={() => setAudioOnly(!audioOnly)} className="btn-ghost !py-2 !px-4 mt-4">{audioOnly ? "Pokaż obraz" : "Tylko dźwięk"}</button>
      {audioOnly && <p className="text-sm text-foreground/50 mt-3">Obraz ukryty, dźwięk gra dalej. Sterowanie odtwarzaniem jest w powiadomieniu telefonu.</p>}
    </div>
  );
}