import React from "react";
import { Link } from "react-router-dom";
import CoverStage from "./CoverStage";
import { CardTopBadge, PriceBlock, ProductButton, SeatsLine, isListenProduct, productHref, scrollToHash } from "./cardBits";
import { RatingLine } from "./Stars";

// Link wewnętrzny albo zewnętrzny (produkty z własnym adresem, np. POWRÓT → /powrot).
// Adres z kotwicą (np. /#listy-powrotu) przewija do sekcji po przejściu na stronę główną.
function To({ href, children, ...rest }) {
  const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
  const jump = hash ? { onClick: () => scrollToHash(hash) } : {};
  return href.startsWith("/") ? <Link to={href} {...rest} {...jump}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
}

// Karta produktu w Skarbcu (zwarta): okładka 16:9, znaczek, nazwa (link do strony produktu),
// obietnica w 3 linijkach, dla kogo, forma, cena, przycisk.
// Karty podcastów i muzyki są klikalne w całości i otwierają nagranie.
export default function ShopProductCard({ product: p, onWaitlist, index }) {
  const soon = p.status === "wkrótce";
  const cover = p.cover_image || p.image_url;
  const listen = isListenProduct(p);
  const listenHref = listen ? (p.checkout_url || "").trim() || "/glos" : null;
  const href = productHref(p);

  return (
    <article
      className={`group relative flex flex-col h-full border hairline bg-[#0D0D0E] transition-colors duration-300 hover:border-[#C9A24A]/40 ${
        soon ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      <To href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[16/9] overflow-hidden bg-[#0F0F10]">
        {cover ? (
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
            <CoverStage src={cover} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-br from-[#141416] to-[#0A0A0B]">
            <span className="shop-heading text-3xl leading-none text-[#C9A24A]/25 select-none">
              {String(index ?? "").padStart(2, "0")}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <CardTopBadge p={p} index={index} />
          {soon && <span className="technical text-[9px] px-2.5 py-1 bg-[#0A0A0B]/85 text-foreground/70 border hairline">WKRÓTCE</span>}
        </div>
      </To>

      <div className="flex flex-col flex-1 p-5 gap-2">
        <h3 className="shop-heading text-lg text-[#F5EFE1] leading-snug">
          <To href={href} className="hover:text-[#C9A24A] transition-colors">{p.name}</To>
        </h3>
        {p.rating_count > 0 && <RatingLine avg={p.rating_avg} count={p.rating_count} className="technical text-[10px] gold-text" />}
        {p.promise && <p className="italic text-foreground/70 text-sm leading-relaxed line-clamp-3">{p.promise}</p>}
        {p.for_whom && <p className="text-xs text-foreground/55 line-clamp-2">{p.for_whom}</p>}
        {(p.form || p.format_details) && (
          <p className="technical text-[9px] text-foreground/55">
            {[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase()}
          </p>
        )}

        <div className="mt-auto pt-4 border-t hairline space-y-2.5">
          {!soon && (
            <div className="text-base text-[#F5EFE1] min-h-[24px]">
              <PriceBlock p={p} />
            </div>
          )}
          <SeatsLine p={p} />
          <ProductButton p={p} onWaitlist={onWaitlist} />
          {p.next_step && !soon && <p className="text-[11px] text-foreground/55 line-clamp-2">{p.next_step}</p>}
          {p.slug === "powrot-mentoring" && (
            <p className="text-[11px] text-foreground/55">Nie da się zapisać przez koszyk. Najpierw rozmawiamy.</p>
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