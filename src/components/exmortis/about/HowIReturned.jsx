import React from "react";
import YouTubeEmbed from "./YouTubeEmbed";

// Podstrona O mnie: „Jak wróciłem” · 02 — historia powrotu i piosenka „Ocalenie”.
export default function HowIReturned() {
  return (
    <section className="py-24 md:py-32 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">PRÓG · 02</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-14 leading-[0.95]">
          Powrót nie przyszedł od razu.
        </h2>

        <div className="max-w-2xl space-y-8 text-lg md:text-xl text-foreground/70 leading-relaxed font-light">
          <p>Najpierw była depresja. Cicha, długa — taka, której z zewnątrz nie widać.</p>
          <p>
            Potem decyzja, że dłużej tak nie mogę. I wtedy pojawiła się ona — kobieta, która
            dziś jest moją żoną. Moje życie obróciło się o 180 stopni.
          </p>
          <p>Ale to jeszcze nie był powrót.</p>
          <p>
            Odszedłem z kapłaństwa i zostałem z niczym. Straciłem pozycję, pracę, znajomych.
            Dla wielu, z którymi szedłem przez lata, stałem się trędowaty.
          </p>
          <p>Chciałem wyjechać. Zmienić nazwisko. Zacząć od zera tam, gdzie nikt mnie nie zna.</p>
          <p>
            <strong className="text-[#E2E2E2] font-normal">Zostałem. Dzięki niej.</strong>
          </p>
          <p>
            Razem zawalczyliśmy o ułożenie życia — przede wszystkim o powrót do komunii z
            Bogiem. Krok po kroku, bez skrótów.
          </p>
          <p>
            Zostałem przeniesiony do stanu świeckiego. Choć wiem, że kapłaństwo zostawia
            znamię, którego nic nie zmaże: „Ty jesteś kapłanem na wieki”.
          </p>
          <p>
            Moja żona otrzymała stwierdzenie nieważności wcześniejszego małżeństwa. Stanęliśmy
            razem przed ołtarzem i zawarliśmy sakramentalne małżeństwo. Wszystko, co było
            rozdarte, zostało uporządkowane.
          </p>
          <p>
            Dziś jestem szczęśliwym mężem i ojcem. Rosnę w komuni z Bogiem. I tę iskrę chcę
            dawać dalej — zamieniać „grzebanie” w „sadzenie”.
          </p>
        </div>

        <div className="mt-20 text-center">
          <div className="w-16 h-px bg-[#C9A24A] mx-auto mb-8" />
          <p className="shop-heading text-2xl md:text-4xl gold-text leading-snug max-w-2xl mx-auto mb-12">
            Moim ocaleniem jest moja żona.
            <br />
            Posłuchaj naszej historii w piosence „Ocalenie”.
          </p>
          <YouTubeEmbed
            videoId="92kTN9ZBipc"
            watchUrl="https://youtu.be/92kTN9ZBipc"
            title="Ocalenie — nasza historia"
          />
        </div>
      </div>
    </section>
  );
}