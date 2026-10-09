import React from "react";
import { Buttons, Lines } from "../parts";

// Wezwanie do działania: wyśrodkowane, z jednym–dwoma przyciskami.
export default function CtaBlock({ d, label }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      {label && <p className="technical text-[11px] gold-text mb-4">{label}</p>}
      {d.tytul && <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95]"><Lines text={d.tytul} /></h2>}
      {d.tekst && <p className="text-foreground/65 text-lg leading-relaxed mt-6">{d.tekst}</p>}
      <Buttons list={d.przyciski} className="justify-center mt-10" />
    </div>
  );
}