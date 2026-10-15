import React from "react";
import Section from "./Section";

const ITEMS = [
  "Osiem sesji indywidualnych 1:1",
  "Twoja własna Mapa powrotu (powstaje w sesji pierwszej)",
  "Arsenał 8 narzędzi głębi — po jednym na każdy etap",
  "Dziennik powrotu z zadaniami między sesjami",
  "Kontakt między sesjami (wiadomości, audio — z granicami)",
  "Domknięcie: osobisty plan „jak nie wrócić do śmierci”",
  "Dostęp do zamkniętej ścieżki „Listów powrotu” tylko dla uczestników programu",
];

export default function Deliverables() {
  return (
    <Section dark label="CO OTRZYMUJESZ · 07">
      <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
        Co <span className="gold-text">dostajesz</span>
      </h2>
      <ul className="max-w-3xl space-y-5 border-l hairline pl-8 mb-12">
        {ITEMS.map((p, i) => (
          <li key={i} className="flex items-baseline gap-4 text-lg text-foreground/80">
            <span className="gold-text font-mono flex-shrink-0">—</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="relic-heading text-2xl md:text-3xl text-foreground/85 leading-tight">
        To nie jest kurs, który się kończy.<br />
        <span className="gold-text">To jest praca, która zostaje.</span>
      </p>
    </Section>
  );
}