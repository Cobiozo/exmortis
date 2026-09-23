import React from "react";
import { Image } from "@/components/ui/image";
import { StageBadge, PriceBlock, ProductButton } from "./cardBits";

// Wyróżniona karta na całą szerokość sekcji (np. „Wracam inny", POWRÓT 1:1).
export default function ShopFeaturedCard({ product: p, onWaitlist, className = "" }) {
  const cover = p.cover_image || p.image_url;
  const mentoring = p.slug === "powrot-mentoring";
  const soon = p.status === "wkrótce";
  return (
    <article
      className={`grid md:grid-cols-2 border border-[#C9A24A]/30 bg-[#0D0D0E] overflow-hidden ${className}`}
    >
      <div className="relative min-h-[280px] bg-[#0F0F10]">
        {cover ? (
          <Image src={cover} alt={p.name} className="absolute inset-0 w-full h-full" fittingType="fill" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-10 text-center bg-gradient-to-br from-[#141416] to-[#0A0A0B]">
            <span className="shop-heading text-3xl text-[#C9A24A]/80 leading-snug">{p.name}</span>
          </div>
        )}
        <div className="absolute top-4 left-4">
          <StageBadge stage={p.stage} />
        </div>
      </div>

      <div className="p-8 md:p-12 flex flex-col gap-4">
        <p className="technical text-[9px] text-foreground/40">POLECANE</p>
        <h3 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug">{p.name}</h3>
        {p.promise && (
          <p className="italic text-foreground/75 text-base md:text-lg leading-relaxed">{p.promise}</p>
        )}
        {p.for_whom && <p className="text-sm text-foreground/40">{p.for_whom}</p>}
        {(p.form || p.format_details) && (
          <p className="technical text-[9px] text-foreground/35">
            {[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase()}
          </p>
        )}

        <div className="mt-auto pt-6 border-t hairline space-y-3">
          {!mentoring && (
            <div className="text-lg text-[#F5EFE1] min-h-[28px]">
              <PriceBlock p={p} />
            </div>
          )}
          <ProductButton p={p} onWaitlist={onWaitlist} />
          {mentoring && (
            <p className="text-[11px] text-foreground/35">
              Nie da się zapisać przez koszyk. Najpierw rozmawiamy.
            </p>
          )}
          {p.next_step && !soon && <p className="text-[11px] text-foreground/35">{p.next_step}</p>}
        </div>
      </div>
    </article>
  );
}