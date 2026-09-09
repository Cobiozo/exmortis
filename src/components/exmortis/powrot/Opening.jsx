import React from "react";
import Section from "./Section";

export default function Opening() {
  return (
    <Section label="OTWARCIE · 01">
      <div className="max-w-3xl space-y-8">
        <p className="relic-heading text-3xl md:text-5xl leading-tight text-foreground/85">
          Są ludzie, którzy przychodzą do mnie, bo coś w nich umarło.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Nie mówią tego wprost. Mówią, że są zmęczeni, stracili sens, nie poznają siebie —
          mają wszystko, na co pracowali, i jednocześnie nic nie czują. Zwłaszcza szczęścia,
          satysfakcji, radości z życia.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Umarli. Tylko jeszcze o tym nie wiedzą.
        </p>
        <p className="relic-heading text-2xl md:text-4xl gold-text leading-tight pt-4">
          POWRÓT jest dla tych, którzy już wiedzą.
        </p>
      </div>
    </Section>
  );
}