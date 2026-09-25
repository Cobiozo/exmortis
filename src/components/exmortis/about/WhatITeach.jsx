import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const DEFAULT_TEACHINGS = [
  "Że powrót jest możliwy. Z każdej z trzech śmierci.",
  "Że nowa wersja Ciebie nie powstanie z tej samej gliny, co poprzednia. Trzeba ją wypalić.",
  "Że cisza jest formą przywództwa nad sobą.",
  "Że odrzucenie nie jest końcem — czasem jest jedynym warunkiem, żeby coś w Tobie mogło zacząć rosnąć naprawdę.",
  "Że pieniądze, sukces, uznanie są efektem dojrzałości, nie odwrotnie.",
  "Że ludzie idą za kimś, kto wrócił. Nie za kimś, kto nigdy nie upadł.",
];

export default function WhatITeach() {
  const { list, rich } = useSiteContent();
  const intro = rich(
    "about",
    "teachIntro",
    "<p>Uczę tego, czego sam się nauczyłem — płacąc pełną cenę.</p>"
  );
  const teachings = list("about", "teachings", DEFAULT_TEACHINGS);

  return (
    <section className="relative py-32 md:py-40 px-5 md:px-10">
      <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
      <div className="mx-auto max-w-4xl">
        <p className="technical text-[11px] gold-text mb-4">CZEGO UCZĘ · 04</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-10 leading-[0.95]">Czego uczę?</h2>
        <div
          className="rich-content text-lg text-foreground/60 mb-16"
          dangerouslySetInnerHTML={{ __html: intro }}
        />
        <div className="space-y-10">
          {teachings.map((t, i) => (
            <div key={i} className="flex gap-6 md:gap-10 items-start">
              <span className="font-mono text-xl gold-text mt-2 flex-shrink-0">0{i + 1}</span>
              <p className="font-heading text-xl md:text-3xl leading-tight text-foreground/85">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}