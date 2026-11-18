import React from "react";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import { soonLabel } from "@/lib/releaseDate";
import ShopMedia from "./ShopMedia";

// Zapowiedzi („wkrótce”): zwarte karty ze statusem lub datą z danych i przyciskiem „Powiadom mnie”.
// Zapis na listę oczekujących działa jak dotąd (to samo okno).
// Użycie: <VaultSoon products={soon} onWaitlist={setWaitlistProduct} />
export default function VaultSoon({ products, onWaitlist }) {
  const list = products || [];
  if (!list.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <article key={p.id || p.slug} className="flex gap-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-4">
          <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2">
            <ShopMedia product={p} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-[15px] leading-snug text-exm-ivory">{p.name}</h3>
            <p className="technical mt-1 text-[10px] text-exm-muted">{soonLabel(p)}</p>
            <div className="mt-auto pt-3">
              <BrandButton variant="secondary" onClick={() => onWaitlist && onWaitlist(p)} className="w-full">
                Powiadom mnie
              </BrandButton>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}