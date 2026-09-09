import React from "react";
import Section from "./Section";

export default function PromiseSection() {
  return (
    <Section label="OBIETNICA · 04">
      <div className="max-w-3xl space-y-8">
        <p className="relic-heading text-3xl md:text-5xl leading-tight text-foreground/85">
          Nie obiecuję Ci, że poczujesz się lepiej.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Obiecuję Ci, że zobaczysz perspektywę wyjścia i powrotu do siebie. Inaczej.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Możesz wyjść z tego, co Cię zabijało po cichu — bo nie ma sytuacji bez wyjścia —
          i stanąć na sensie, na którym da się stanąć na dłużej niż tydzień.
        </p>
        <p className="relic-heading text-2xl md:text-4xl gold-text leading-tight pt-4">
          Nowa wersja Ciebie nie powstanie z tej samej gliny, co poprzednia.
          Trzeba ją wypalić. Właśnie tego uczę.
        </p>
      </div>
    </Section>
  );
}