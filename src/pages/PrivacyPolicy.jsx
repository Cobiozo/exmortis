import React from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  {
    label: "01",
    title: "Kto za to odpowiada",
    body: [
      "Administratorem danych jest Dawid — twórca marki exmortis. Kontakt w każdej sprawie dotyczącej danych: przez formularz kontaktowy na stronie głównej.",
    ],
  },
  {
    label: "02",
    title: "Jakie dane zbieram",
    body: [
      "Zamówienia i darmowe materiały: imię oraz e-mail — tyle, ile potrzeba, żeby wysłać Ci to, o co prosisz.",
      "Telefon: tylko jeśli sam go podasz. Dzwonię wyłącznie wtedy, gdy osobno zaznaczysz zgodę na kontakt telefoniczny — i zapisuję datę oraz godzinę udzielenia tej zgody.",
      "Newsletter „Listy powrotu”: adres e-mail dodaję do listy tylko wtedy, gdy zaznaczysz zgodę w formularzu. Datę i godzinę tej zgody również zapisuję.",
      "Listy oczekujących i wiadomości z formularzy: imię, e-mail i treść, którą mi piszesz.",
    ],
  },
  {
    label: "03",
    title: "Czego nie robię",
    body: [
      "Nie sprzedaję i nie przekazuję Twoich danych nikomu. Korzystam wyłącznie z usług niezbędnych do działania strony: obsługi płatności (PayU) i wysyłki e-maili.",
    ],
  },
  {
    label: "04",
    title: "Newsletter i kontakt",
    body: [
      "Listy powrotu dostajesz tylko za Twoją zgodą — jeden list w każdy poniedziałek. Wypisujesz się jednym kliknięciem w każdej chwili.",
      "Zgody możesz wycofać w dowolnym momencie. Bez zaznaczenia zgody numer telefonu nie jest używany do kontaktu.",
    ],
  },
  {
    label: "05",
    title: "Twoje prawa",
    body: [
      "Masz prawo wglądu w swoje dane, ich poprawienia i usunięcia oraz wycofania zgody. Napisz przez formularz kontaktowy — załatwię to jak najszybciej.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="mx-auto max-w-[900px] px-5 md:px-10 pt-16 md:pt-24 pb-24">
        <p className="technical text-[11px] gold-text mb-6">DOKUMENT</p>
        <h1 className="relic-heading text-4xl md:text-6xl mb-14 leading-[0.95]">
          Polityka<br />prywatności
        </h1>

        <div className="space-y-14">
          {SECTIONS.map((s) => (
            <div key={s.label} className="border-t hairline pt-8">
              <p className="technical text-[10px] gold-text mb-4">{s.label}</p>
              <h2 className="shop-heading text-2xl text-[#F5EFE1] mb-5">{s.title}</h2>
              <div className="space-y-4">
                {s.body.map((p, i) => (
                  <p key={i} className="text-foreground/60 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-foreground/30 mt-16">
          Jeśli jesteś w kryzysie, zadzwoń: 800 70 2222 (całą dobę) lub 116 123. W zagrożeniu
          życia: 112.
        </p>

        <Link to="/" className="btn-ghost mt-12">
          WRÓĆ NA POCZĄTEK
        </Link>
      </section>
    </div>
  );
}