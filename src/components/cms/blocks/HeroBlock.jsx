import React, { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import Logo from "@/components/exmortis/Logo";
import { Buttons } from "../parts";
import SafeImg from "../SafeImg";

function Bg({ d }) {
  if (!d.tlo?.url) return null;
  return (
    <div className="absolute inset-0">
      <SafeImg img={{ ...d.tlo, alt: "" }} eager className="w-full h-full" style={{ opacity: 1 - (d.przyciemnienie ?? 60) / 100 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B]/60 to-[#0A0A0B]" />
    </div>
  );
}

// Nagłówek strony (H1). Wariant „znak” = pełnoekranowy hero strony głównej z logo.
export default function HeroBlock({ d }) {
  const ref = useRef(null);
  const [cue, setCue] = useState(true);
  useEffect(() => {
    const on = () => setCue(window.scrollY < 80);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const next = () => ref.current?.closest("[data-block]")?.nextElementSibling?.scrollIntoView({ behavior: "smooth" });

  if (d.wariant === "znak") return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden grain" style={{ minHeight: "100svh" }}>
      <Bg d={d} />
      <div className="relative z-10 flex flex-col items-center text-center px-6 pb-32 max-w-4xl">
        <div className="flicker mt-14 md:mt-20"><Logo className="h-[8.75rem] w-[8.75rem] md:h-[12.5rem] md:w-[12.5rem] mb-8" /></div>
        {d.etykieta && <p className="technical text-[11px] gold-text mb-4">{d.etykieta}</p>}
        <h1 className="font-heading text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.95]">
          <span className="block tracking-[0.06em]">{d.linia1}</span>
          {d.linia2 && <span className="block gold-text mt-3 text-2xl sm:text-3xl md:text-4xl lg:text-[4rem]">{d.linia2}</span>}
        </h1>
        {d.lead && <p className="mt-8 text-lg md:text-2xl text-foreground/75 font-light">{d.lead}</p>}
        {d.podlead && <p className="mt-2 text-sm md:text-base text-foreground/50 font-light">{d.podlead}</p>}
        <Buttons list={d.przyciski} className="mt-12 justify-center" />
        {d.dopisek && <p className="technical text-[9px] text-foreground/40 mt-3">{d.dopisek}</p>}
      </div>
      <button onClick={next} aria-label="Przewiń w dół"
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground/40 transition-opacity duration-500 ${cue ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <span className="technical text-[9px]">PRZEWIŃ</span>
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </button>
    </section>
  );

  return (
    <section ref={ref} className="relative min-h-[70vh] flex items-end overflow-hidden grain px-5 md:px-10 pt-40 pb-20">
      <Bg d={d} />
      <div className="relative z-10 mx-auto max-w-[1400px] w-full">
        {d.etykieta && <p className="technical text-[11px] gold-text mb-6">{d.etykieta}</p>}
        <h1 className="relic-heading text-5xl md:text-7xl lg:text-8xl">
          <span className="block">{d.linia1}</span>
          {d.linia2 && <span className="block gold-text">{d.linia2}</span>}
        </h1>
        {d.lead && <p className="mt-8 text-lg md:text-xl text-foreground/70 max-w-2xl leading-relaxed">{d.lead}</p>}
        {d.podlead && <p className="mt-3 text-foreground/50 max-w-2xl">{d.podlead}</p>}
        <Buttons list={d.przyciski} className="mt-10" />
        {d.dopisek && <p className="technical text-[9px] text-foreground/40 mt-3">{d.dopisek}</p>}
      </div>
    </section>
  );
}