import React from "react";
import Logo from "../Logo";

export default function PowrotHero() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden grain pt-20">
      <div className="relative z-10 text-center px-6 max-w-4xl py-24">
        <Logo className="h-20 w-20 mx-auto mb-10" glow={false} />
        <h1 className="relic-heading text-6xl md:text-9xl gold-text leading-[0.9] mb-6 flicker">
          POWRÓT
        </h1>
        <p className="technical text-[11px] text-foreground/60 mb-10">
          AUTORSKI PROGRAM MENTORSKI EXMORTIS
        </p>
        <p className="text-foreground/70 text-lg md:text-xl font-light leading-relaxed">
          4–6 miesięcy. Osiem sesji. Jedna decyzja: „chcę wrócić inny.”
        </p>
      </div>
    </section>
  );
}