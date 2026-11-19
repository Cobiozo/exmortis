import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import TimerView from "./views/TimerView";
import { fixedClock } from "./views/useFrame";
import SilenceCardPanel from "./SilenceCardPanel";
import CiszaFrame from "./CiszaFrame";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// Ekran końcowy: przygaszone 00:00, słowo na koniec, „Jeszcze raz” i „Wróć”,
// jeden dyskretny odnośnik do Listów powrotu, karta ciszy bez zmian.
export default function CiszaEnd({ text, onAgain, onLogo, reduced, view, minutes, backdrop }) {
  const clock = useMemo(() => fixedClock(1), []);
  return (
    <CiszaFrame onLogo={onLogo} onHome={onLogo}>
      <div className={`flex w-full max-w-xl flex-col items-center gap-4 text-center sm:gap-5 [@media(max-height:600px)]:gap-3 ${reduced ? "" : "fade-up"}`}>
        <div className="opacity-40 scale-50 -my-8 origin-center" aria-hidden="true">
          <TimerView clock={clock} view={view} reduced />
        </div>
        <h1 className="exm-h1 max-w-[20ch]">{text}</h1>
        <p className="max-w-[38ch] text-[15px] leading-relaxed text-exm-muted">Jeśli chcesz, będę pisać do Ciebie listy o drodze powrotu.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <BrandButton onClick={onAgain} className="min-w-[9rem]">Jeszcze raz</BrandButton>
          <BrandButton variant="secondary" onClick={onLogo} className="min-w-[7rem]">Wróć</BrandButton>
        </div>
        <Link to="/#listy-powrotu" className="btn-link text-sm">Chcę dostawać Listy powrotu</Link>
        <SilenceCardPanel view={view} minutes={minutes} backdrop={backdrop} />
      </div>
    </CiszaFrame>
  );
}