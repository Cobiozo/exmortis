import React from "react";
import { ChevronDown } from "lucide-react";
import { Buttons, SectionHead } from "../parts";
import { Img } from "./SimpleBlocks";

export function CardsBlock({ d, label, center }) {
  const cols = d.kolumny === "2" ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <>
      <SectionHead label={label} title={d.tytul} intro={d.intro} center={center} />
      <div className={`grid ${cols} gap-px bg-[#3D3D3F]/40 text-left`}>
        {(d.karty || []).map((c, i) => (
          <div key={i} className="bg-[#0A0A0B] p-10 md:p-12 group hover:bg-[#070708] transition-colors duration-500 flex flex-col">
            {c.obraz?.url && <Img img={c.obraz} ratio="3:2" className="mb-8" />}
            {d.numerowane && <p className="font-mono text-5xl text-foreground/15 mb-8">{String(i + 1).padStart(2, "0")}</p>}
            <h3 className="relic-heading text-2xl gold-text mb-5">{c.tytul}</h3>
            <p className="text-foreground/60 leading-relaxed">{c.opis}</p>
            <Buttons list={c.przycisk} className="mt-8" />
          </div>
        ))}
      </div>
    </>
  );
}

export function StepsBlock({ d, label, center }) {
  const row = d.uklad !== "pionowy";
  return (
    <>
      <SectionHead label={label} title={d.tytul} center={center} />
      <ol className={row ? "grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-left" : "space-y-8 max-w-3xl text-left"}>
        {(d.elementy || []).map((e, i) => (
          <li key={i} className="border-t border-[#C9A24A]/40 pt-6">
            <p className="technical text-[10px] gold-text mb-3">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="relic-heading text-2xl mb-3">{e.tytul}</h3>
            {e.opis && <p className="text-foreground/60 leading-relaxed">{e.opis}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

export function FaqBlock({ d, label, center }) {
  return (
    <>
      <SectionHead label={label} title={d.tytul} center={center} />
      <div className="max-w-3xl text-left divide-y divide-[#3D3D3F]/60 border-y hairline">
        {(d.pytania || []).map((q, i) => (
          <details key={i} className="group py-5">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-lg">
              {q.pytanie}<ChevronDown className="h-4 w-4 gold-text shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-foreground/60 leading-relaxed whitespace-pre-line">{q.odpowiedz}</p>
          </details>
        ))}
      </div>
    </>
  );
}