import React from "react";
import Section from "./Section";

const FAQ = [
  {
    q: "Czym to się różni od terapii?",
    a: "Terapia leczy zaburzenie. Mentoring prowadzi przez zmianę. Terapeuta pomaga Ci zrozumieć siebie. Mentor idzie z Tobą przez próg. Jeśli jesteś w klinicznym kryzysie — najpierw terapeuta, potem ja. Jeśli jesteś zdrowy, ale zablokowany — jestem od tego.",
  },
  {
    q: "Ile trwa jedna sesja?",
    a: "60 minut w rytmie sesji + pierwsza sesja diagnostyczna do 90 minut. Bez pośpiechu. Cisza w środku sesji jest częścią pracy.",
  },
  {
    q: "Jaka jest inwestycja?",
    a: "2 999 PLN za pełny cykl. Płatność jednorazowo. Nie sprzedaję sesji — sprzedaję drogę.",
  },
  {
    q: "Co, jeśli w trakcie stwierdzę, że to nie dla mnie?",
    a: "Po trzeciej sesji jest naturalny moment weryfikacji. Jeśli któreś z nas uzna, że to nie ta praca — kończymy, rozliczam się z Tobą za wykonane sesje, reszta wraca do Ciebie. Chronię Twoje pieniądze tak samo jak Twoją drogę.",
  },
  {
    q: "Czy widujemy się na żywo?",
    a: "Cały program prowadzony jest przez platformę Zoom — po to, żeby był dostępny niezależnie od miasta. Uczestnicy POWRÓT-u mają pierwszeństwo i specjalne warunki w zapisach na doroczny retreat „exmortis” w Bieszczadach.",
  },
  {
    q: "Jak często rusza nowa kohorta?",
    a: "Nie prowadzę kohort. Program jest indywidualny — startujesz wtedy, kiedy Ty i ja jesteśmy gotowi.",
  },
  {
    q: "Czy to jest to samo, co Pure Life?",
    a: "Nie. Pure Life to przestrzeń systematycznej pracy nad pięcioma płaszczyznami dojrzałości, prowadzona z zespołem liderów i specjalistów. POWRÓT w Exmortis to indywidualna, głęboka praca ze mną — jeden na jeden. Można korzystać z obu. Można z jednego. Można z żadnego.",
  },
];

export default function Faq() {
  return (
    <Section dark label="FAQ">
      <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
        Pytania, które <span className="gold-text">słyszę najczęściej</span>
      </h2>
      <div className="max-w-3xl">
        {FAQ.map((f, i) => (
          <div key={i} className="py-8 border-b hairline first:pt-0">
            <p className="relic-heading text-xl md:text-2xl gold-text mb-4">{f.q}</p>
            <p className="text-foreground/60 leading-relaxed">{f.a}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}