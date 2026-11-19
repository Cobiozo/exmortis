import React from "react";
import Section from "./Section";
import { POWROT, ROZMOWA_WSTEPNA } from "@/lib/powrotOffer";

// PODSUMOWANIE przed zgłoszeniem — tylko wartości już obecne na stronie, zebrane w jednej ramce.
// Parametry (cena, sesje, czas, częstotliwość, forma, start) pochodzą z src/lib/powrotOffer.js.
const FOR_WHOM =
  "Wracasz z wypalenia, kryzysu, rozstania albo sukcesu, który nie smakuje — i wiesz, że tak dalej nie chcesz.";

const INCLUDED = [
  `${POWROT.sessions} sesji po ${POWROT.lengthLong} ${POWROT.cadence}`,
  POWROT.months,
  `online (${POWROT.form})`,
  "Mapa powrotu",
  "Dziennik powrotu",
  "materiały po sesjach w Twoim koncie",
  "kontakt między sesjami w ustalonych granicach",
];

// Co stanie się po zgłoszeniu — dawny blok „Pięć spokojnych kroków”, teraz tuż nad formularzem (19.11.2026).
const STEPS = [
  ["Odpowiedź", `Czytam każde zgłoszenie osobiście i odpowiadam w ciągu ${POWROT.responseHours} godzin. Jeśli widzę sens dalszej rozmowy, wysyłam Ci ankietę.`],
  ["Ankieta", "Kilka pytań, które porządkują Twoją sytuację i oczekiwania. Pytania o zdrowie są nieobowiązkowe i wymagają Twojej osobnej zgody."],
  ["Rozmowa wstępna", `Na zaproszenie: ${ROZMOWA_WSTEPNA.minutes} minut online, bezpłatnie. Sprawdzamy wzajemne dopasowanie — to nie jest sesja ani terapia.`],
  ["Decyzja i start", "Jeśli oboje zdecydujemy się na współpracę, dostajesz umowę, link do płatności i termin startu."],
];

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
          <Row label="PO ZGŁOSZENIU">
            <p>Samo zgłoszenie zajmie około 2 minut. Potem:</p>
            <ol className="mt-3 space-y-3">
              {STEPS.map(([t, o], i) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="technical w-5 shrink-0 pt-[3px] text-[10px] gold-text">{String(i + 1).padStart(2, "0")}</span>
                  <span><span className="text-foreground/90">{t}.</span> {o}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm">Zgłoszenie jest bezpłatne, nie zobowiązuje do zakupu i nie oznacza automatycznego przyjęcia do programu.</p>
          </Row>
          <Row label="INWESTYCJA">
            <p className="text-foreground/90">{POWROT.priceFull}</p>
            <p className="mt-1 text-sm">{POWROT.installments}</p>
          </Row>
          <Row label="START">{POWROT.start} · najwyżej {POWROT.capacity} osoby jednocześnie</Row>
        </div>
      </div>
    </Section>
  );
}