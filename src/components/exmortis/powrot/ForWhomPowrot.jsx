import React from "react";
import Section from "./Section";

const POINTS = [
  "Wracasz z wypalenia, które nie mija po urlopie",
  "Wracasz z kryzysu, który zdarł Ci maskę",
  "Wracasz z rozstania, które zabrało więcej niż osobę",
  "Wracasz z pozycji, w której łatwo się zgubić",
  "Wracasz z sukcesu, który nie smakuje",
  "Wracasz z ciszy po stracie",
  "Wracasz z siebie sprzed kilku lat, do którego nie chcesz już wrócić",
];

export default function ForWhomPowrot() {
  return (
    <Section label="DLA KOGO · 02" title={<>To praca dla Ciebie, <span className="gold-text">jeśli:</span></>}>
      <div className="max-w-3xl">
        <ul className="space-y-5 border-l hairline pl-8">
          {POINTS.map((p, i) => (
            <li key={i} className="flex items-baseline gap-4 text-lg md:text-xl text-foreground/80">
              <span className="gold-text font-mono flex-shrink-0">—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-12 relic-heading text-2xl md:text-3xl text-foreground/85 leading-tight">
          Nie musisz wiedzieć, dokąd wracasz.<br />
          <span className="gold-text">Wystarczy, że wiesz, że tak dalej nie chcesz.</span>
        </p>
      </div>
    </Section>
  );
}