import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const THREE_TRUTHS = [
  "Siła nie jest warunkiem powrotu. Wystarczy pierwszy ruch.",
  "Śmierć mentalna, duchowa i życiowa nie są końcem — są progiem.",
  "Nie wracasz do dawnej wersji siebie. Wracasz jako ktoś nowy.",
];

const STAGES = [
  { name: "Śmierć", text: "Nazywasz to, co w tobie umarło." },
  { name: "Próg", text: "Zatrzymujesz się i decydujesz, że wracasz." },
  { name: "Powrót", text: "Krok po kroku budujesz siebie na nowo." },
  { name: "Inny", text: "Nie wracasz do dawnej wersji siebie. Wracasz jako ktoś nowy." },
];

// Strona główna: „Droga powrotu” — trzy zdania i ścieżka czterech etapów.
export default function ReturnPath() {
  const { list } = useSiteContent();
  const truths = list("home", "truths", THREE_TRUTHS);

  return (
    <section className="py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">DROGA POWROTU · 05</p>
        <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-16">
          Droga powrotu
        </h2>

        <div className="space-y-12 mb-28">
          {truths.map((t, i) => (
            <div key={i} className="flex gap-6 md:gap-10 items-start">
              <span className="font-mono text-xl gold-text mt-2 flex-shrink-0">0{i + 1}</span>
              <p className="relic-heading text-2xl md:text-4xl leading-tight text-foreground/85">
                {t}
              </p>
            </div>
          ))}
        </div>

        {/* Ścieżka czterech etapów */}
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#C9A24A]/40 md:hidden" />
          <div className="hidden md:block absolute top-[7px] left-0 right-0 h-px bg-[#C9A24A]/40" />
          <div className="grid md:grid-cols-4 gap-12 md:gap-8">
            {STAGES.map((s, i) => (
              <div key={s.name} className="relative pl-8 md:pl-0 md:pt-10">
                <span className="absolute left-0 top-1 md:top-0 w-4 h-4 rounded-full border border-[#C9A24A] bg-[#0A0A0B]" />
                <p className="font-mono text-sm gold-text mb-2">0{i + 1} · ETAP</p>
                <h3 className="relic-heading text-2xl md:text-3xl mb-3">{s.name}</h3>
                <p className="text-foreground/60 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}