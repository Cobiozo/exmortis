import React from "react";

const POINTS = [
  "Wracasz z wypalenia zawodowego",
  "Wracasz z kryzysu w relacji",
  "Wracasz z fasady, którą budowałeś latami",
  "Wracasz do siebie, którego kiedyś zostawiłeś",
  "Wracasz z ciszy po stracie",
  "Wracasz z pozycji lidera, który się w tej pozycji zgubił",
  "Wracasz z etapu, który dał Ci wszystko oprócz Ciebie",
];

export default function ForWhom() {
  return (
    <section className="py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <p className="technical text-[11px] gold-text mb-4">DLA KOGO · 04</p>
          <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-8">
            To dla Ciebie,<br /><span className="gold-text">jeśli:</span>
          </h2>
          <p className="relic-heading text-2xl md:text-3xl gold-text leading-tight">
            Wracam inny.<br />Uczę wracać.
          </p>
        </div>
        <div className="md:col-span-7 flex flex-col justify-center">
          <ul className="space-y-5 border-l hairline pl-8 md:pl-10">
            {POINTS.map((p, i) => (
              <li key={i} className="flex items-baseline gap-4 text-lg md:text-xl text-foreground/80">
                <span className="gold-text font-mono flex-shrink-0">—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-foreground/50 leading-relaxed max-w-lg">
            Jeśli którykolwiek punkt zabrzmiał jak Twoje życie — jesteś we właściwym miejscu.
            Pierwszy ruch zrobisz dziś.
          </p>
        </div>
      </div>
    </section>
  );
}