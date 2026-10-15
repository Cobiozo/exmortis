import React from "react";
import ShopProductCard from "./ShopProductCard";
import ShopFeaturedCard from "./ShopFeaturedCard";
import ShopEventCard from "@/components/exmortis/events/ShopEventCard";
import { ShopProductTile, ShopProductRow } from "./ShopCompactViews";

// Sekcja poziomu drabiny: Brama, Pierwszy krok, Praktyka, Krąg, Głębia.
// Karty numerowane po kolei — darmowe pokazują numer z napisem „DARMOWE" u góry.
export default function ShopLevelSection({ section, products, events, onWaitlist, view = "karty" }) {
  const list = products || [];
  const eventList = events || [];
  if (list.length === 0 && eventList.length === 0) return null;
  const featured = list.filter((p) => p.is_featured);
  const rest = list.filter((p) => !p.is_featured);
  let n = 0;

  return (
    <section id={`poziom-${section.level}`} className="py-14 md:py-20 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <div className="relative mb-8 md:mb-10">
          <span
            aria-hidden="true"
            className="hidden md:block absolute right-0 top-0 shop-heading text-[5rem] leading-none text-[#F5EFE1]/5 select-none pointer-events-none"
          >
            {String(section.level).padStart(2, "0")}
          </span>
          <div className="max-w-2xl">
            <p className="technical text-[11px] gold-text mb-4">
              {section.label} · {String(section.level).padStart(2, "0")}
            </p>
            <h2 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mb-3">{section.title}</h2>
            <p className="text-foreground/55">{section.line}</p>
          </div>
        </div>

        {/* Kafelki i lista: wszystkie produkty poziomu w jednym zwartym układzie (bez dużej karty wyróżnionej). */}
        {view === "kafelki" && list.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...featured, ...rest].map((p) => <ShopProductTile key={p.id} product={p} index={++n} />)}
          </div>
        )}
        {view === "lista" && list.length > 0 && (
          <div className="border-t hairline">
            {[...featured, ...rest].map((p) => <ShopProductRow key={p.id} product={p} index={++n} />)}
          </div>
        )}

        {view === "karty" && featured.map((p) => (
          <ShopFeaturedCard
            key={p.id}
            product={p}
            onWaitlist={onWaitlist}
            index={++n}
            className="mb-5"
          />
        ))}

        {view === "karty" && rest.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 items-stretch">
            {rest.map((p) => (
              <ShopProductCard key={p.id} product={p} onWaitlist={onWaitlist} index={++n} />
            ))}
          </div>
        )}

        {eventList.length > 0 && (
          <div className={`flex overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-2 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 ${featured.length > 0 || rest.length > 0 ? "mt-5" : ""}`}>
            {eventList.map((ev) => (
              <ShopEventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}