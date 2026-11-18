import React from "react";
import { BrandButton, Container } from "@/components/exmortis/ui";
import TestHelp from "./TestHelp";

// Ekran startu testu: etykieta, tytuł, liczba stwierdzeń i czas z danych testu, informacja o prywatności,
// granice i przycisk „Zacznij test”. Wstęp (dotychczasowa treść) zostaje pod przyciskiem, w zwartszej formie.
const LEAD = "Są rzeczy, które kończą się bez pożegnania.";
const BODY = [
  "Nie słychać trzasku drzwi. Nikt nie ogłasza końca. Świat się nie zatrzymuje.",
  "Nadal odbierasz telefony. Idziesz do pracy. Wracasz do domu. Odpowiadasz, że wszystko w porządku.",
  "Tylko Ty wiesz, ile z dawnego życia zostało w Tobie.",
  "Może życie dla innych zajęło miejsce życia dla siebie.",
  "Może to, co przez lata nadawało Twojemu życiu kierunek, przestało prowadzić.",
  "A może wydarzyło się coś, co zabrało Ci nie tylko człowieka, miejsce lub przyszłość, która miała nadejść — ale także część dawnego świata.",
];
const BEFORE = "Przeczytasz piętnaście zdań. Nie szukaj właściwej odpowiedzi. Nie próbuj wypaść dobrze. Sprawdź tylko, które zdania mogłyby zostać zapisane w Twojej historii.";

export default function TestStart({ n, time, onStart }) {
  return (
    <Container narrow>
      <p className="exm-eyebrow">Test</p>
      <h1 className="exm-h1 mt-4">Która śmierć jest Twoja?</h1>
      <p className="exm-lead mt-5">Piętnaście zdań. Trzy śmierci. Jedna historia — Twoja.</p>
      <p className="technical mt-5 text-[11px] text-exm-muted">
        {n} stwierdzeń i pytanie o etap · {time} · bez rejestracji
      </p>

      <div className="mt-8 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
        <BrandButton onClick={onStart} className="w-full sm:w-auto">Zacznij test</BrandButton>
        <p className="mt-5 text-[13px] leading-relaxed text-exm-muted">
          Odpowiedzi nie są nigdzie zapisywane ani wysyłane — znikają po zamknięciu strony.
        </p>
        <p className="mt-2 text-[13px] font-medium text-exm-ivory">Autorefleksja, nie diagnoza.</p>
      </div>

      <div className="mt-10 space-y-3 border-t border-exm-line pt-8">
        <p className="font-exm-serif text-[clamp(1.15rem,2.6vw,1.4rem)] leading-snug text-exm-ivory">{LEAD}</p>
        {BODY.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed text-exm-muted">{p}</p>
        ))}
        <p className="text-[15px] leading-relaxed text-exm-muted">
          W EXMORTIS nazywam te doświadczenia trzema śmierciami.{" "}
          <strong className="font-semibold text-exm-ivory">Mentalną. Duchową. Życiową.</strong>
        </p>
        <p className="text-[15px] leading-relaxed text-exm-muted">
          Nie są chorobami. Nie są wyrokami. Są nazwami, które nadaję różnym ludzkim doświadczeniom.
        </p>
        <p className="text-[15px] leading-relaxed text-exm-muted">{BEFORE}</p>
      </div>

      <TestHelp className="mt-8" />
    </Container>
  );
}