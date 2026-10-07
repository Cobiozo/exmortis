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
    <CiszaFrame onLogo={onLogo}>
      <div className={`flex flex-col items-center text-center ${reduced ? "" : "fade-up"}`}>
        <div className="opacity-40 scale-50 -my-8 origin-center"><TimerView clock={clock} view={view} reduced /></div>
        <p className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] max-w-2xl leading-tight mt-4">{text}</p>
        <div className="mt-10 flex items-center gap-8 text-sm">
          <button onClick={onAgain} className="text-foreground/55 hover:text-[#C9A24A] transition-colors">Jeszcze raz</button>
          <Link to="/sklep" className="text-foreground/55 hover:text-[#C9A24A] transition-colors">Wróć do Skarbca</Link>
        </div>
        <SilenceCardPanel view={view} minutes={minutes} backdrop={backdrop} />
      </div>
    </CiszaFrame>
  );
}