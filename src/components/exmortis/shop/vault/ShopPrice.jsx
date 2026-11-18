import React from "react";
import { cn } from "@/lib/utils";
import { isPromoActive, isPresale, priceOnRequest, regularPrice, lowestPrice30, nextPriceText, zl, kwota } from "@/lib/productPrice";

// Cena produktu w Skarbcu — jedno miejsce dla kart, wyróżnienia i strony produktu.
// Promocja zawsze z najniższą ceną z 30 dni przed obniżką; ceny wyłącznie z danych produktu.
// Użycie: <ShopPrice p={product} />  ·  <ShopPrice p={product} size="large" showEnd />
const endDate = (p) =>
  new Date(`${String(p.promo_end_date).slice(0, 10)}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });

export default function ShopPrice({ p, size = "card", showEnd = false, className = "" }) {
  if (!p || p.status === "wkrótce") return null;
  const big = size === "large";
  const value = big ? "font-exm-serif text-3xl text-exm-gold" : "text-lg text-exm-gold";

  if (p.is_free) {
    return <span className={cn(big ? "font-exm-serif text-2xl text-exm-ivory" : "text-[15px] text-exm-ivory", className)}>Bezpłatnie</span>;
  }

  // Karta podarunkowa: kwoty do wyboru z danych produktu.
  const amounts = Array.isArray(p.price_options)
    ? [...new Set(p.price_options.map(Number).filter((n) => n > 0))].sort((a, b) => a - b)
    : [];
  if (p.product_type === "karta" && amounts.length > 1) {
    return (
      <span className={cn(big ? "font-exm-serif text-2xl text-exm-gold" : "text-[15px] text-exm-ivory", className)}>
        {amounts.map(kwota).join(" · ")} zł
      </span>
    );
  }

  if (isPromoActive(p) && p.price_start != null) {
    return (
      <span className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
        {!isPresale(p) && <s className="text-exm-muted">{zl(regularPrice(p))}</s>}
        <span className={value}>{zl(p.price_start)}</span>
        {showEnd && (
          <span className="technical text-[10px] text-exm-muted">
            {isPresale(p) ? "Cena w przedsprzedaży do " : "Do "}
            {endDate(p).toUpperCase()}
          </span>
        )}
        {nextPriceText(p) && <span className="basis-full text-[12px] text-exm-gold">{nextPriceText(p)}</span>}
        {!isPresale(p) && (
          <span className="basis-full text-[12px] text-exm-muted">Najniższa cena z 30 dni przed obniżką: {zl(lowestPrice30(p))}</span>
        )}
      </span>
    );
  }

  if (priceOnRequest(p)) {
    return <span className={cn("technical text-[11px] text-exm-muted", className)}>Po rozmowie</span>;
  }

  const regular = regularPrice(p);
  return regular > 0 ? <span className={cn(value, className)}>{zl(regular)}</span> : null;
}