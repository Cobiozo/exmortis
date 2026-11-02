import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/track";
import { SectionHead } from "@/components/cms/parts";

// „Od czego zacząć" — trzy pierwsze kroki. Treść stała w kodzie (jak pozostałe moduły sekcyjne),
// kliknięcie wysyła zdarzenie z parametrem `cel` (bez danych osobowych).
const PATHS = [
  {
    cel: "test",
    tytul: "Sprawdź, gdzie jesteś",
    opis: "Bezpłatny test, 15 pytań, około 3 minut.",
    cta: "ZRÓB TEST",
    to: "/test?src=home-start",
  },
  {
    cel: "spotkania",
    tytul: "Posłuchaj na żywo",
    opis: "Bezpłatne spotkanie online, bez zobowiązań.",
    cta: "ZOBACZ SPOTKANIA",
    to: "/spotkania",
  },
  {
    cel: "powrot",
    tytul: "Porozmawiajmy",
    opis: "Bezpłatna rozmowa kwalifikacyjna do programu POWRÓT.",
    cta: "ZGŁOŚ SIĘ",
    to: "/powrot#formularz",
  },
];

export default function StartPaths({ d = {}, label }) {
  return (
    <section className="py-24 md:py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <SectionHead label={label || "OD CZEGO ZACZĄĆ"} title={d.tytul || "Trzy sposoby na pierwszy krok"} />
        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          {PATHS.map((p, i) => (
            <div key={p.cel} className="flex flex-col border hairline bg-[#070708] p-7 md:p-8">
              <p className="technical text-[11px] gold-text mb-6">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="relic-heading text-2xl md:text-3xl leading-[0.98] mb-4">{p.tytul}</h3>
              <p className="text-foreground/70 leading-relaxed mb-8 flex-1">{p.opis}</p>
              <Link
                to={p.to}
                onClick={() => track("home_start_click", { cel: p.cel })}
                className="btn-ghost w-full justify-center"
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}