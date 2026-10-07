import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TIMES } from "./prefs";
import BgList from "./BgList";
import ViewPicker from "./ViewPicker";

// Ekran 1 — wybór czasu, tła i widoku.
export default function CiszaChoose({
  minutes, setMinutes, tracks, bgId, onBg, onStart, reduced,
  view, onView, showTime, onShowTime, minutesOnly, onMinutesOnly,
}) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80);
    return () => clearTimeout(t);
  }, []);

  const list = tracks ? tracks.filter((t) => t.czas_min === minutes) : [];
  const current = list.find((t) => t.id === bgId);
  const intro = (current || list.find((t) => t.domyslny) || list[0])?.plik_wstep;

  return (
    <section
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24 transition-opacity"
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
              onClick={() => { setMinutes(m); setOpen(false); }}
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

        <div className="mt-8 flex flex-col items-center gap-3 min-h-[24px]">
          {tracks && list.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Zmień tło dźwiękowe"
              className="inline-flex items-center gap-2 text-sm text-foreground/50 hover:text-[#F5EFE1]"
            >
              Tło: <span className="text-[#C9A24A]">{current ? current.nazwa : "Bez muzyki"}</span>
              <ChevronDown className="h-4 w-4" strokeWidth={1.25} />
            </button>
          )}
          {tracks && list.length === 0 && (
            <p className="text-sm text-foreground/35">Dla tego czasu nie ma jeszcze dźwięku</p>
          )}
          {open && <BgList tracks={list} value={bgId} onChange={(id) => { onBg(id); setOpen(false); }} />}
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
        {intro && <audio src={intro} preload="auto" className="hidden" />}
      </div>
    </section>
  );
}