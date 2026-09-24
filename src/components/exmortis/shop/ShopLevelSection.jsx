import React from "react";
import ShopProductCard from "./ShopProductCard";
import ShopFeaturedCard from "./ShopFeaturedCard";
import ShopEventCard from "@/components/exmortis/events/ShopEventCard";

// Sekcja poziomu drabiny: Brama, Pierwszy krok, Praktyka, Krąg, Głębia.
export default function ShopLevelSection({ section, products, events, onWaitlist }) {
  const list = products || [];
  const eventList = events || [];
  if (list.length === 0 && eventList.length === 0) return null;
  const featured = list.filter((p) => p.is_featured);
  const rest = list.filter((p) => !p.is_featured);

  return (
    <section id={`poziom-${section.level}`} className="py-24 md:py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <div className="relative mb-12 md:mb-16">
          <span
            aria-hidden="true"
            className="hidden md:block absolute right-0 top-0 shop-heading text-[7rem] leading-none text-[#F5EFE1]/5 select-none pointer-events-none"
          >
            {String(section.level).padStart(2, "0")}
          </span>
          <div className="max-w-2xl">
            <p className="technical text-[11px] gold-text mb-4">
              {section.label} · {String(section.level).padStart(2, "0")}
            </p>
            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] mb-4">{section.title}</h2>
            <p className="text-foreground/50">{section.line}</p>
          </div>
        </div>

        {featured.map((p) => (
          <ShopFeaturedCard key={p.id} product={p} onWaitlist={onWaitlist} className="mb-6 md:mb-8" />
        ))}

        {rest.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((p) => (
              <ShopProductCard key={p.id} product={p} onWaitlist={onWaitlist} />
            ))}
          </div>
        )}

        {eventList.length > 0 && (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-6 ${featured.length > 0 || rest.length > 0 ? "mt-6" : ""}`}>
            {eventList.map((ev) => (
              <ShopEventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}