import React from "react";
import { Youtube, Music2 } from "lucide-react";
import ShopProductCard from "./ShopProductCard";

// Sekcja „Muzyka" — soundtrack powrotu + linki do słuchania.
export default function MusicSection({ products, onWaitlist }) {
  const soundtrack = (products || []).find((p) => p.slug === "soundtrack-powrotu");
  return (
    <section className="py-24 md:py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid md:grid-cols-12 gap-10 items-end mb-12">
          <div className="md:col-span-7">
            <p className="technical text-[11px] gold-text mb-4">MUZYKA</p>
            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] leading-tight">
              Ta droga wyrosła z muzyki.
            </h2>
          </div>
          <div className="md:col-span-5 flex flex-wrap gap-3 md:justify-end">
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !px-5 !py-3 text-[10px]"
            >
              <Music2 className="h-3.5 w-3.5" /> SPOTIFY
            </a>
            <a
              href="https://www.youtube.com/@e.x.m.o.r.t.i.s"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !px-5 !py-3 text-[10px]"
            >
              <Youtube className="h-3.5 w-3.5" /> YOUTUBE
            </a>
          </div>
        </div>
        {soundtrack && (
          <div className="max-w-md">
            <ShopProductCard product={soundtrack} onWaitlist={onWaitlist} />
          </div>
        )}
      </div>
    </section>
  );
}