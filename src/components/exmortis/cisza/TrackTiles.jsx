import React, { useEffect, useState } from "react";
import { Play, Square, VolumeX } from "lucide-react";
import { preview, stopPreview } from "./library";

// Kafelki utworów przed startem: wybór + 10-sekundowy podgląd.
export default function TrackTiles({ tracks, value, onChange }) {
  const [playing, setPlaying] = useState(null);
  useEffect(() => () => stopPreview(), []);

  const listen = (t) => {
    if (playing === t.id) return stopPreview();
    setPlaying(t.id);
    preview(t, () => setPlaying((p) => (p === t.id ? null : p)));
  };

  const tile = (sel) =>
    `relative text-left p-3 border transition-colors ${sel ? "border-[#C9A24A]" : "border-[#C9A24A]/20 hover:border-[#C9A24A]/50"}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
      {tracks.map((t) => (
        <div key={t.id} className={tile(value === t.id)}>
          <button onClick={() => onChange(t.id)} aria-pressed={value === t.id} className="block w-full text-left">
            <span className="block h-10 mb-2 bg-cover bg-center" style={{ backgroundColor: t.kolor || "#1A1712", backgroundImage: t.miniatura ? `url(${t.miniatura})` : undefined }} />
            <span className="block text-sm text-[#F5EFE1] pr-8">{t.nazwa}</span>
            {t.opis && <span className="block text-[11px] text-foreground/45 mt-0.5">{t.opis}</span>}
          </button>
          <button onClick={() => listen(t)} aria-label={playing === t.id ? "Zatrzymaj podgląd" : `Posłuchaj: ${t.nazwa}`}
            className="absolute right-2 bottom-2 h-7 w-7 flex items-center justify-center border border-[#C9A24A]/40 text-[#C9A24A] hover:bg-[#C9A24A]/10">
            {playing === t.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
        </div>
      ))}
      <button onClick={() => onChange("none")} aria-pressed={value === "none"} className={tile(value === "none")}>
        <span className="flex h-10 mb-2 items-center justify-center bg-[#0F0F10]"><VolumeX className="h-4 w-4 text-foreground/40" strokeWidth={1.25} /></span>
        <span className="block text-sm text-[#F5EFE1]">Bez muzyki</span>
        <span className="block text-[11px] text-foreground/45 mt-0.5">tylko wstęp i zakończenie</span>
      </button>
    </div>
  );
}