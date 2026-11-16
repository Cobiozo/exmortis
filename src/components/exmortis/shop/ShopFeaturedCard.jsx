import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import CoverStage from "./CoverStage";
import { CardTopBadge, PriceBlock, ProductButton, productHref } from "./cardBits";
import { fixText } from "@/lib/typography";

// Link wewnętrzny albo zewnętrzny (jak w ShopProductCard).
function To({ href, children, ...rest }) {
  return href.startsWith("/") ? <Link to={href} {...rest}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
}

// Wyróżniona karta na całą szerokość sekcji (np. „Wracam inny", POWRÓT 1:1).
// Okładka, nazwa i „Zobacz szczegóły” prowadzą na stronę produktu — jak w zwykłych kartach (16.11.2026).
export default function ShopFeaturedCard({ product: p, onWaitlist, index, className = "" }) {
  const cover = p.cover_image || p.image_url;
  const mentoring = p.slug === "powrot-mentoring";
  const soon = p.status === "wkrótce";
  const href = productHref(p);
  return (
    <article
      className={`group grid md:grid-cols-2 border border-[#C9A24A]/30 bg-[#0D0D0E] overflow-hidden transition-colors duration-300 hover:border-[#C9A24A]/60 ${className}`}
    >
      <To href={href} tabIndex={-1} aria-hidden="true" className="relative block min-h-[200px] md:min-h-[240px] bg-[#0F0F10]">
        {cover ? (
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
            <CoverStage src={cover} alt={p.name} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-10 text-center bg-gradient-to-br from-[#141416] to-[#0A0A0B]">
            <span className="shop-heading text-3xl text-[#C9A24A]/80 leading-snug">{p.name}</span>
          </div>
        )}
        <div className="absolute top-4 left-4">
          <CardTopBadge p={p} index={index} />
        </div>
      </To>

      <div className="p-6 md:p-10 flex flex-col gap-4">
        <p className="technical text-[9px] text-foreground/55">POLECANE</p>
        <h3 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug">
          <To href={href} className="hover:text-[#C9A24A] transition-colors">{p.name}</To>
        </h3>
        {p.promise && (
          <p className="italic text-foreground/75 text-base leading-relaxed">{fixText(p.promise)}</p>
        )}
        {p.for_whom && <p className="text-sm text-foreground/55">{fixText(p.for_whom)}</p>}
        {(p.form || p.format_details) && (
          <p className="technical text-[9px] text-foreground/55">
            {[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase()
            }
          </p>
        )}
        {!mentoring && (
          <To href={href} className="self-start inline-flex items-center gap-2 technical text-[10px] gold-text hover:underline underline-offset-4">
            ZOBACZ SZCZEGÓŁY <ArrowRight className="h-3.5 w-3.5" />
          </To>
        )}

        <div className="mt-auto pt-5 border-t hairline space-y-3 md:max-w-sm">
          {!mentoring && (
            <div className="text-lg text-[#F5EFE1] min-h-[28px]">
              <PriceBlock p={p} />
            </div>
          )}
          <ProductButton p={p} onWaitlist={onWaitlist} />
          {mentoring && (
            <p className="text-[11px] text-foreground/55">
              Nie da się zapisać przez koszyk. Najpierw rozmawiamy.
            </p>
          )}
          {p.next_step && !soon && <p className="text-[11px] text-foreground/55">{p.next_step}</p>}
        </div>
      </div>
    </article>
  );
}
