import React from "react";
import { Link } from "react-router-dom";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import { fixText } from "@/lib/typography";
import { productHighlight } from "@/lib/productHighlight";
import { productHref } from "@/components/exmortis/shop/cardBits";
import ShopMedia from "./ShopMedia";
import ShopPrice from "./ShopPrice";

// Karta produktu w siatce Skarbca: okładka 3:4, jedna etykieta, cena i przycisk na dole.
// Bezpłatne: „Pobierz” prowadzi na stronę materiału (formularz wysyła plik mailem — bez zmian).
// Użycie: <VaultCard product={p} />
export default function VaultCard({ product: p }) {
  const hl = productHighlight(p);
  const href = productHref(p);
  const free = !!p.is_free;
  const label = free ? "Pobierz" : p.product_type === "karta" ? "Wybierz kwotę" : "Zobacz";

  return (
    <BrandCard
      variant="produkt"
      media={<Link to={href} aria-label={p.name} tabIndex={-1} className="absolute inset-0 block"><ShopMedia product={p} /></Link>}
      highlight={hl ? <ProductHighlight kind={hl} /> : null}
      label={free ? "Bezpłatnie" : p.form || null}
      title={p.name}
      meta={p.format_details || p.format || null}
      action={
        <div className="space-y-3">
          {!free && <ShopPrice p={p} />}
          <BrandButton to={href} variant="secondary" className="w-full">{label}</BrandButton>
        </div>
      }
    >
      {p.promise && <p className="line-clamp-3 text-[15px] leading-relaxed text-exm-muted">{fixText(p.promise)}</p>}
    </BrandCard>
  );
}