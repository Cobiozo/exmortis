import React from "react";
import Section from "./Section";

export default function PromiseSection() {
  return (
    <Section label="BEZ OBIETNIC · 04">
      <div className="max-w-3xl space-y-8">
        <p className="relic-heading text-3xl md:text-5xl leading-tight text-foreground/85">
          Nie obiecuję Ci, że poczujesz się lepiej.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Nie obiecuję gotowych rozwiązań ani szybkiej ulgi. Moją rolą jest iść obok Ciebie, kiedy szukasz perspektywy i kolejnych kroków.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Razem przyglądamy się temu, co po cichu Cię wyniszcza, i szukamy sensu, na którym
          można budować dłużej niż przez tydzień. Tempo i kierunek zależą od Ciebie.
        </p>
        <p className="relic-heading text-2xl md:text-4xl gold-text leading-tight pt-4">
          Nowa wersja Ciebie nie powstanie z tej samej gliny, co poprzednia.
          Trzeba ją wypalić. Właśnie tego uczę.
        </p>
      </div>
    </Section>
  );
}