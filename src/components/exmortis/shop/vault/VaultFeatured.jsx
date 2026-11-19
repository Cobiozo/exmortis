import React from "react";
import PaperCard from "@/components/exmortis/ui/PaperCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import { fixText } from "@/lib/typography";
import { productHighlight } from "@/lib/productHighlight";
import ShopMedia from "./ShopMedia";
import ShopPrice from "./ShopPrice";

// Wyróżnienie książki na stronie Skarbca: szeroka karta pozioma — okładka 3:4 na papierze po lewej,
// tytuł, podtytuł, format i liczba stron z danych, cena z promocją i przycisk po prawej.
// Użycie: <VaultFeatured product={book} />
export default function VaultFeatured({ product: p }) {
  const hl = productHighlight(p);
  const format = p.format_details || p.format || "";

  return (
    <article className="grid gap-6 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:gap-10 md:p-8">
      <PaperCard className="h-fit self-start p-3 md:p-4">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2">
          <ShopMedia product={p} />
          {hl && (
            <div className="absolute left-3 top-3">
              <ProductHighlight kind={hl} />
            </div>
          )}
        </div>
      </PaperCard>

      <div className="flex min-w-0 flex-col">
        <p className="exm-eyebrow">Książka</p>
        <h3 className="exm-h2 mt-3 text-balance">{p.name}</h3>
        {p.subtitle && <p className="mt-3 text-[17px] leading-relaxed text-exm-muted">{fixText(p.subtitle)}</p>}
        {format && <p className="technical mt-4 text-[11px] text-exm-muted">{format}</p>}
        <div className="mt-6">
          <ShopPrice p={p} size="large" showEnd />
        </div>
        <div className="mt-6 md:mt-8">
          <BrandButton to={`/skarbiec/${p.slug}`} className="w-full sm:w-auto">Zobacz książkę</BrandButton>
        </div>
      </div>
    </article>
  );
}