import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { CardTopBadge, PriceBlock, ProductButton, isListenProduct } from "./cardBits";

// Karta produktu w Skarbcu: okładka, znaczek, obietnica, cena, przycisk.
// Karty podcastów i muzyki są klikalne w całości i otwierają nagranie.
export default function ShopProductCard({ product: p, onWaitlist, index }) {
  const soon = p.status === "wkrótce";
  const cover = p.cover_image || p.image_url;
  const listen = isListenProduct(p);
  const listenHref = listen ? (p.checkout_url || "").trim() || "/glos" : null;

  return (
    <article
      className={`group relative flex flex-col h-full border hairline bg-[#0D0D0E] transition-all duration-500 hover:border-[#C9A24A]/40 ${
        soon ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0F0F10]">
        {cover ? (
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
            <Image src={cover} alt={p.name} className="w-full h-full" fittingType="fill" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-center">
            <span className="shop-heading text-xl text-[#C9A24A]/70 leading-snug">{p.name}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <CardTopBadge p={p} index={index} />
        </div>
      </div>

      <div className="flex flex-col flex-1 p-7 gap-3">
        <h3 className="shop-heading text-xl text-[#F5EFE1] leading-snug">{p.name}</h3>
        {p.promise && <p className="italic text-foreground/70 text-sm leading-relaxed">{p.promise}</p>}
        {p.for_whom && <p className="text-xs text-foreground/40">{p.for_whom}</p>}
        {(p.form || p.format_details) && (
          <p className="technical text-[9px] text-foreground/35">
            {[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase()}
          </p>
        )}

        <div className="mt-auto pt-5 border-t hairline space-y-3">
          <div className="text-base text-[#F5EFE1] min-h-[24px]">
            <PriceBlock p={p} />
          </div>
          <ProductButton p={p} onWaitlist={onWaitlist} />
          {p.next_step && !soon && <p className="text-[11px] text-foreground/35">{p.next_step}</p>}
          {p.slug === "powrot-mentoring" && (
            <p className="text-[11px] text-foreground/35">Nie da się zapisać przez koszyk. Najpierw rozmawiamy.</p>
          )}
        </div>
      </div>

      {listen &&
        (listenHref.startsWith("/") ? (
          <Link to={listenHref} className="absolute inset-0 z-10" aria-label={p.name} />
        ) : (
          <a href={listenHref} target="_blank" rel="noreferrer" className="absolute inset-0 z-10" aria-label={p.name} />
        ))}
    </article>
  );
}