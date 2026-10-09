import React from "react";
import Logo from "@/components/exmortis/Logo";
import { Buttons } from "../parts";
import SafeImg from "../SafeImg";
import { nbsp } from "@/lib/nbsp";

function Bg({ d }) {
  if (!d.tlo?.url) return null;
  return (
    <div className="absolute inset-0">
      <SafeImg img={{ ...d.tlo, alt: "" }} eager className="w-full h-full" style={{ opacity: 1 - (d.przyciemnienie ?? 60) / 100 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B]/60 to-[#0A0A0B]" />
    </div>
  );
}

const Dopisek = ({ t }) => t ? <p className="technical text-xs text-foreground/75 mt-3">{t}</p> : null;

// Nagłówek strony (H1). Wariant „znak” = pełnoekranowy hero strony głównej z logo.
export default function HeroBlock({ d }) {
  if (d.wariant === "znak") return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain" style={{ minHeight: "100svh" }}>
      <Bg d={d} />
      <div className="relative z-10 flex flex-col items-center text-center px-6 pb-32 max-w-4xl">
        <div className="flicker mt-14 md:mt-20"><Logo className="h-[8.75rem] w-[8.75rem] md:h-[12.5rem] md:w-[12.5rem] mb-8" /></div>
        {d.etykieta && <p className="technical text-[11px] gold-text mb-4">{d.etykieta}</p>}
        <h1 className="font-heading text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.95]">
          <span className="block tracking-[0.06em]">{nbsp(d.linia1)}</span>
          {d.linia2 && <span className="block gold-text mt-3 text-2xl sm:text-3xl md:text-4xl lg:text-[4rem]">{nbsp(d.linia2)}</span>}
        </h1>
        {d.lead && <p className="no-hyph mt-8 text-lg md:text-2xl text-foreground/75 font-light">{nbsp(d.lead)}</p>}
        {d.podlead && <p className="no-hyph mt-2 text-sm md:text-base text-foreground/50 font-light">{d.podlead}</p>}
        <Buttons list={d.przyciski} className="mt-12 justify-center" />
        <Dopisek t={d.dopisek} />
      </div>
    </section>
  );

  return (
    <section className="relative min-h-[70vh] flex items-end overflow-hidden grain px-5 md:px-10 pt-40 pb-20">
      <Bg d={d} />
      <div className="relative z-10 mx-auto max-w-[1400px] w-full">
        {d.etykieta && <p className="technical text-[11px] gold-text mb-6">{d.etykieta}</p>}
        <h1 className="relic-heading text-[clamp(2rem,10.5vw,3rem)] md:text-7xl lg:text-8xl">
          <span className="block">{nbsp(d.linia1)}</span>
          {d.linia2 && <span className="block gold-text">{nbsp(d.linia2)}</span>}
        </h1>
        {d.lead && <p className="no-hyph mt-8 text-lg md:text-xl text-foreground/70 max-w-2xl leading-relaxed">{nbsp(d.lead)}</p>}
        {d.podlead && <p className="no-hyph mt-3 text-foreground/50 max-w-2xl">{d.podlead}</p>}
        <Buttons list={d.przyciski} className="mt-10" />
        <Dopisek t={d.dopisek} />
      </div>
    </section>
  );
}