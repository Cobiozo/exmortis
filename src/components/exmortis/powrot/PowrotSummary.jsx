import React from "react";
import Section from "./Section";
import { POWROT } from "@/lib/powrotOffer";

// PODSUMOWANIE przed zgłoszeniem — tylko wartości już obecne na stronie, zebrane w jednej ramce.
// Parametry (cena, sesje, czas, częstotliwość, forma, start) pochodzą z src/lib/powrotOffer.js.
const FOR_WHOM =
  "Wracasz z wypalenia, kryzysu, rozstania albo sukcesu, który nie smakuje — i wiesz, że tak dalej nie chcesz.";

const INCLUDED = [
  `${POWROT.sessions} sesji 1:1 ${POWROT.cadence}`,
  POWROT.months,
  POWROT.form,
  "Mapa powrotu",
  `${POWROT.tools} narzędzi głębi`,
  "dziennik z zadaniami",
];

const QUALIFICATION =
  "Krótkie zgłoszenie, bezpłatna rozmowa kwalifikacyjna, ankieta i wspólna decyzja — bez zobowiązań.";

function Row({ label, children }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[168px_1fr] sm:gap-8 py-5 border-t hairline first:border-t-0 first:pt-0">
      <p className="technical text-[10px] gold-text sm:pt-1">{label}</p>
      <div className="min-w-0 text-foreground/70 leading-relaxed">{children}</div>
    </div>
  );
}

export default function PowrotSummary() {
  return (
    <Section id="podsumowanie" label="PODSUMOWANIE">
      <div className="max-w-3xl">
        <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-10">
          Zanim <span className="gold-text">wyślesz zgłoszenie</span>
        </h2>
        <div className="border hairline bg-[#070708] px-6 py-7 md:px-10 md:py-9">
          <Row label="DLA KOGO">{FOR_WHOM}</Row>
          <Row label="CO OBEJMUJE">
            <p>{INCLUDED.slice(0, 3).join(" · ")}</p>
            <p className="mt-1">{INCLUDED.slice(3).join(", ")}.</p>
          </Row>
          <Row label="KWALIFIKACJA">{QUALIFICATION}</Row>
          <Row label="INWESTYCJA">
            <p className="text-foreground/90">{POWROT.priceFull}</p>
          </Row>
          <Row label="START">{POWROT.start}</Row>
        </div>
      </div>
    </Section>
  );
}