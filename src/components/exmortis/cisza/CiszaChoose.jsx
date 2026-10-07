import React, { useEffect, useState } from "react";
import BackdropPicker from "./backdrop/BackdropPicker";
import { TIMES } from "./prefs";
import TrackTiles from "./TrackTiles";
import { offsetFor } from "./library";
import ViewPicker from "./ViewPicker";

// Ekran 1 — wybór czasu, tła i widoku.
export default function CiszaChoose({
  minutes, setMinutes, tracks, bgId, onBg, onStart, reduced,
  view, onView, showTime, onShowTime, minutesOnly, onMinutesOnly,
  backdrops, backdropId, onBackdrop, match, introUrl, outros = [], outroId, onOutro,
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80);
    return () => clearTimeout(t);
  }, []);

  const current = (tracks || []).find((t) => t.id === bgId);

  return (
    <section
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-24 transition-opacity"
      style={{ transitionDuration: reduced ? "0ms" : "1500ms", opacity: shown ? 1 : 0 }}
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1]">Chwila ciszy</h1>
        <p className="mt-6 text-foreground/60 leading-relaxed max-w-xl mx-auto">
          Kiedy nauczysz się siedzieć w ciszy dłużej niż trzy minuty, zaczynasz słyszeć
          rzeczy, których hałas nie pozwalał Ci usłyszeć. Wybierz czas. Resztę zostaw mnie.
        </p>

        <div className="mt-14 grid grid-cols-3 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4">
          {TIMES.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className={`sm:w-28 py-5 shop-heading text-2xl border transition-colors duration-700 ${
                minutes === m
                  ? "bg-[#C9A24A] border-[#C9A24A] text-[#0A0A0B]"
                  : "border-[#C9A24A]/60 text-[#C9A24A] hover:border-[#C9A24A]"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        <div className="mt-10">
          <p className="technical text-[10px] text-foreground/40 mb-4">Dźwięk</p>
          {tracks && <TrackTiles tracks={tracks} value={bgId} onChange={onBg} />}
          {outros.length > 1 && (
            <label className="mt-4 inline-flex items-center gap-2 text-xs text-foreground/50">
              Dźwięk końca:
              <select value={outroId || ""} onChange={(e) => onOutro(e.target.value)} className="bg-[#0A0A0B] border border-[#C9A24A]/30 px-2 py-1 text-[#F5EFE1]/80">
                {outros.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
              </select>
            </label>
          )}
          {current?.plik && <audio key={current.id} src={`${current.plik}#t=${Math.floor(offsetFor(current, 0))}`} preload="auto" className="hidden" />}
        </div>

        <div className="mt-10">
          <p className="technical text-[10px] text-foreground/40 mb-4">Tło</p>
          <BackdropPicker items={backdrops} value={backdropId} onChange={onBackdrop} match={match} onMatch={() => onBg(match.id)} />
        </div>

        <div className="mt-10">
          <p className="technical text-[10px] text-foreground/40 mb-4">Widok</p>
          <ViewPicker value={view} onChange={onView} reduced={reduced} />
          {view === "cyfry" && (
            <label className="mt-4 inline-flex items-center gap-2 text-xs text-foreground/50 cursor-pointer">
              <input type="checkbox" checked={minutesOnly} onChange={(e) => onMinutesOnly(e.target.checked)} className="accent-[#C9A24A]" />
              Same minuty
            </label>
          )}
          {view !== "cyfry" && (
            <label className="mt-4 inline-flex items-center gap-2 text-xs text-foreground/50 cursor-pointer">
              <input type="checkbox" checked={showTime} onChange={(e) => onShowTime(e.target.checked)} className="accent-[#C9A24A]" />
              Pokaż czas
            </label>
          )}
        </div>

        <button onClick={onStart} className="btn-relic mt-10">Zacznij</button>

        <p className="mt-8 text-xs text-foreground/35 max-w-md mx-auto leading-relaxed">
          Najlepiej usiądź, połóż telefon obok — dźwięk na końcu da Ci znać, że czas minął.
        </p>
        {introUrl && <audio src={introUrl} preload="auto" className="hidden" />}
      </div>
    </section>
  );
}