import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import TimerView from "./views/TimerView";
import { fixedClock } from "./views/useFrame";
import SilenceCardPanel from "./SilenceCardPanel";
import CiszaFrame from "./CiszaFrame";

// Ekran końcowy: 00:00 z pełnym paskiem, słowo na koniec, karta ciszy.
export default function CiszaEnd({ text, onAgain, onLogo, reduced, view, minutes, backdrop }) {
  const clock = useMemo(() => fixedClock(1), []);
  return (
    <CiszaFrame onLogo={onLogo} onHome={onLogo}>
      <div className={`flex flex-col items-center text-center ${reduced ? "" : "fade-up"}`}>
        <div className="opacity-40 scale-50 -my-8 origin-center"><TimerView clock={clock} view={view} reduced /></div>
        <p className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] max-w-2xl leading-tight mt-4">{text}</p>
        {/* Spokojny następny krok zamiast sklepu (audyt 17.11.2026, X-22). */}
        <p className="mt-8 text-sm text-foreground/60 max-w-md leading-relaxed">Jeśli chcesz, raz w tygodniu napiszę do Ciebie list — bez pośpiechu i bez reklam.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <Link to="/#listy-powrotu" className="text-[#C9A24A] underline underline-offset-4 hover:text-[#E2C170] transition-colors min-h-11 inline-flex items-center">Chcę dostawać Listy powrotu</Link>
          <button onClick={onAgain} className="text-foreground/55 hover:text-[#C9A24A] transition-colors min-h-11">Jeszcze raz</button>
        </div>
        <SilenceCardPanel view={view} minutes={minutes} backdrop={backdrop} />
      </div>
    </CiszaFrame>
  );
}