import React from "react";
import Section from "./Section";
import { POWROT_HOW_ROWS } from "@/lib/powrotOffer";

const META = POWROT_HOW_ROWS.map((r) => ({ label: r.label.toUpperCase(), value: r.value }));

export default function HowItWorks() {
  return (
    <Section label="JAK TO WYGLĄDA · 06">
      <div className="grid md:grid-cols-4 gap-px bg-[#3D3D3F]/40 mb-12">
        {META.map((m) => (
          <div key={m.label} className="bg-[#0A0A0B] p-6">
            <p className="technical text-[9px] text-foreground/55 mb-2">{m.label}</p>
            <p className="text-sm md:text-base">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="max-w-3xl space-y-6 text-foreground/60 text-lg leading-relaxed">
        <p>
          Osiem sesji, cztery etapy. Od diagnozy — gdzie jesteś, co umarło — po plan,
          żeby nie wrócić do śmierci.
        </p>
        <p>
          Między sesjami: zadania szyte pod Ciebie, dziennik powrotu, kontakt ze mną
          w ustalonych granicach. Nie zostawiam Cię między spotkaniami.
        </p>
      </div>
    </Section>
  );
}