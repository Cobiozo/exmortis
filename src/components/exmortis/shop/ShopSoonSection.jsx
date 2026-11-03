import React from "react";
import ShopProductCard from "./ShopProductCard";
import { ShopProductTile, ShopProductRow } from "./ShopCompactViews";

// Zapowiedzi („wkrótce”) zebrane niżej, osobno od tego, co można kupić teraz.
// Lista oczekujących działa jak dotąd — przez kartę produktu.
export default function ShopSoonSection({ products, onWaitlist, view = "karty" }) {
  const list = products || [];
  if (list.length === 0) return null;
  let n = 0;

  return (
    <section id="poziom-wkrotce" className="py-14 md:py-20 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl mb-8 md:mb-10">
          <p className="technical text-[11px] gold-text mb-4">W PRZYGOTOWANIU</p>
          <h2 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mb-3">Materiały w przygotowaniu</h2>
          <p className="text-foreground/70">
            Tych materiałów nie można jeszcze kupić. Zostaw adres — napiszę, kiedy będą gotowe.
          </p>
        </div>

        {view === "kafelki" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {list.map((p) => <ShopProductTile key={p.id} product={p} index={++n} />)}
          </div>
        )}
        {view === "lista" && (
          <div className="border-t hairline">
            {list.map((p) => <ShopProductRow key={p.id} product={p} index={++n} />)}
          </div>
        )}
        {view === "karty" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 items-stretch">
            {list.map((p) => <ShopProductCard key={p.id} product={p} onWaitlist={onWaitlist} index={++n} />)}
          </div>
        )}
      </div>
    </section>
  );
}