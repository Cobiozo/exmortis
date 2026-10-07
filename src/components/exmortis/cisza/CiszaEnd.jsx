import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Stage from "./Stage";
import { fixedClock } from "./views/useFrame";
import SilenceCardPanel from "./SilenceCardPanel";

// Ekran końcowy — w tle ostatnia klatka wybranego widoku (przygaszona).
export default function CiszaEnd({ text, onAgain, reduced, view, minutes }) {
  const clock = useMemo(() => fixedClock(1), []);
  const stageRef = useRef(null);
  const [turn, setTurn] = useState(false);

  const again = () => {
    if (view === "klepsydra" && !reduced) { setTurn(true); setTimeout(onAgain, 1200); }
    else onAgain();
  };

  return (
    <section className="fixed inset-0 cisza-vignette flex items-center justify-center">
      <div className={`absolute inset-0 flex items-center justify-center opacity-25 ${turn ? "glass-turn !opacity-60" : ""}`} aria-hidden="true">
        <Stage view={view} clock={clock} slow={1000} stageRef={stageRef} />
      </div>
      <div className={`relative z-10 flex flex-col items-center px-8 text-center transition-opacity duration-700 ${reduced ? "" : "fade-up"}`} style={{ opacity: turn ? 0 : 1 }}>
        <p className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] max-w-2xl leading-tight">{text}</p>
        <div className="mt-14 flex items-center gap-8 text-sm">
          <button onClick={again} className="text-foreground/55 hover:text-[#C9A24A] transition-colors">Jeszcze raz</button>
          <Link to="/sklep" className="text-foreground/55 hover:text-[#C9A24A] transition-colors">Wróć do Skarbca</Link>
        </div>
        <SilenceCardPanel stageRef={stageRef} view={view} minutes={minutes} />
      </div>
    </section>
  );
}