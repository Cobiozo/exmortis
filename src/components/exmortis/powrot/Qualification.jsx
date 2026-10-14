import React from "react";
import Section from "./Section";

const STEPS = [
  "Wypełniasz krótkie zgłoszenie (kilka pytań o to, z czego wracasz i czego szukasz)",
  "Umawiamy rozmowę kwalifikacyjną — bezpłatnie, bez zobowiązań",
  "Po rozmowie oboje decydujemy: czy to Twój moment i czy jestem Twoim przewodnikiem",
  "Jeśli tak — ustalamy termin startu i formę współpracy",
];

export default function Qualification() {
  return (
    <Section label="KWALIFIKACJA · 08">
      <div className="grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95]">
            Cztery osoby.<br /><span className="gold-text">Zero pośpiechu.</span>
          </h2>
          <p className="mt-8 text-foreground/60 leading-relaxed">
            Prowadzę maksymalnie cztery osoby jednocześnie w programie POWRÓT.
            Nie dlatego, że wybieram lepszych. Dlatego, że to praca, którą można wykonać
            tylko z osobami gotowymi — a moja uwaga ma pojemność.
          </p>
        </div>
        <div className="md:col-span-7">
          <div className="space-y-8">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-6">
                <span className="font-mono text-xl gold-text mt-1 flex-shrink-0">
                  0{i + 1}
                </span>
                <p className="text-foreground/75 text-lg leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-foreground/55 leading-relaxed border-l hairline pl-6">
            Jeśli po rozmowie któreś z nas uzna, że to nie ten moment albo nie ta osoba —
            rozstajemy się w dobrym. Bez presji z żadnej strony.
          </p>
        </div>
      </div>
    </Section>
  );
}