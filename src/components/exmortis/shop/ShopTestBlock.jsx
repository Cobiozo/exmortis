import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Rich } from "@/components/cms/parts";

// Blok testu na górze Skarbca („NIE WIESZ, OD CZEGO ZACZĄĆ?” + „ZRÓB TEST”).
// Dwie sąsiednie sekcje CMS tworzą jedną cienką złotą ramkę: zaproszenie u góry, przycisk pod nim.
// Ramka łączy się na styku (intro bez dolnej krawędzi, przycisk bez górnej) — bez podwójnych linii.
const SHELL = "bg-[#070708] px-5 md:px-10";
const FRAME = "border-[#C9A24A]/40 bg-[#0D0D0E]/60";

export default function ShopTestBlock({ part, d = {} }) {
  const intro = part !== "action";
  const buttons = Array.isArray(d.przyciski) && d.przyciski.length
    ? d.przyciski
    : [{ etykieta: "Zrób test", link: "/test" }];

  return (
    <section className={SHELL}>
      <div className="mx-auto max-w-[1400px]">
        <div
          className={`${FRAME} ${intro ? "border-x border-t rounded-t-2xl pt-10 pb-6 md:pt-14 md:pb-8" : "border-x border-b rounded-b-2xl pb-10 md:pb-14"} px-5 md:px-10`}
        >
          {intro ? (
            <div className="max-w-3xl">
              {d.etykieta && (
                <h2 className="shop-heading text-xl md:text-2xl uppercase tracking-[0.08em] gold-text mb-5">
                  {d.etykieta}
                </h2>
              )}
              <Rich html={d.tresc} className="text-[#F5EFE1]/85 text-lg md:text-xl leading-relaxed" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {buttons.map((b, i) => (
                <Link
                  key={i}
                  to={b.link || "/test"}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-3 bg-[#C9A24A] text-[#0A0A0B] px-7 min-h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#E2C170] transition-colors"
                >
                  {b.etykieta || "Zrób test"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}