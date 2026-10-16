import React, { useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";

const RATES = [0.8, 1, 1.25, 1.5];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Nagranie audio we wspólnym odtwarzaczu strony (gra w tle, Media Session, wznowienie od miejsca).
export default function ObokAudio({ n, seria, onSave }) {
  const p = usePodcastPlayer();
  const mine = p.ep?.id === `obok-${n.id}`;
  const last = useRef(0);
  // Aktualne wartości dla zapisu przy wyjściu — bez zamkniętych wartości z momentu montowania.
  const now = useRef({ mine: false, t: 0 });
  now.current = { mine, t: p.t };
  const ep = { id: `obok-${n.id}`, audio: n.src, tytul: n.tytul, numer: n.numer, okladka: n.obraz || seria.okladka, href: `/obok/${seria.slug}/${n.numer}`, dlugosc_s: n.dlugosc_s };

  useEffect(() => {
    if (!mine) return;
    if (Math.abs(p.t - last.current) >= 15) { last.current = p.t; onSave(Math.floor(p.t)); }
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: n.tytul, artist: `exmortis · ${seria.nazwa}`, artwork: [{ src: "/favicon.ico" }] });
  }, [mine, p.t]);
  useEffect(() => () => { if (now.current.mine) onSave(Math.floor(now.current.t)); }, []);

  const dur = (mine && p.dur) || n.dlugosc_s || 0;
  const t = mine ? p.t : n.pozycja_s;
  return (
    <div className="border hairline p-5">
      <div className="flex items-center gap-4">
        <button onClick={() => (mine ? p.toggle() : p.play(ep, n.pozycja_s || 0))} aria-label={mine && p.playing ? "Pauza" : "Odtwórz"} className="h-14 w-14 shrink-0 flex items-center justify-center bg-[#C9A24A] text-[#0A0A0B]">
          {mine && p.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        <input type="range" min={0} max={dur || 1} value={t} onChange={(e) => mine && p.seek(Number(e.target.value))} aria-label="Pozycja" className="flex-1 accent-[#C9A24A]" />
        <span className="text-xs text-foreground/55 tabular-nums">{fmt(t)} / {fmt(dur)}</span>
      </div>
      {mine && (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button onClick={() => p.skip(-15)} aria-label="Cofnij 15 s" className="p-2 text-foreground/60 hover:gold-text"><RotateCcw className="h-4 w-4" /></button>
          <button onClick={() => p.skip(15)} aria-label="Dalej 15 s" className="p-2 text-foreground/60 hover:gold-text"><RotateCw className="h-4 w-4" /></button>
          {RATES.map((r) => <button key={r} onClick={() => p.setRate(r)} className={`technical text-[10px] px-2 py-1 border ${p.rate === r ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55"}`}>{r}×</button>)}
        </div>
      )}
    </div>
  );
}