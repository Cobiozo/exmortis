import React from "react";
import { Link } from "react-router-dom";
import ShopPrice from "@/components/exmortis/shop/vault/ShopPrice";
import { SeatsLine } from "@/components/exmortis/shop/cardBits";
import InBundleLink from "@/components/exmortis/shop/InBundleLink";
import { isPromoActive, priceOnRequest, zl } from "@/lib/productPrice";
import { fixText } from "@/lib/typography";
import ProductActions from "./ProductActions";
import { sameText } from "./text";

// Prawa kolumna karty produktu: etykieta typu, tytuł, podtytuł, opis, meta, cena i przycisk główny.
// Pod przyciskiem informacja o dostarczeniu (z treści produktu) i o płatności PayU.
const TYPES = {
  pdf: "E-book",
  audio: "Nagranie",
  kurs: "Kurs",
  wideo: "Wideo",
  zestaw: "E-book z nagraniami",
  usluga: "Usługa indywidualna",
  karta: "Karta podarunkowa",
  pakiet: "Pakiet",
};

export default function ProductPurchase({ product, qty, setQty, onBuy, onAdd, added, onWaitlist }) {
  const soon = product.status === "wkrótce";
  const promo = !soon && !product.is_free && product.product_type !== "karta" && isPromoActive(product);
  const linkUrl = (product.checkout_url || "").trim();
  const pay = !product.is_free && !soon && !priceOnRequest(product);
  const meta = [
    ["FORMAT", product.format || product.format_details],
    ["CZAS", product.duration],
    ["MIEJSCA", product.spots],
  ].filter(([, v]) => v);

  return (
    <div className="flex min-w-0 flex-col">
      <p className="exm-eyebrow">{TYPES[product.product_type] || product.category}</p>
      <h1 className="exm-h1 mt-4 [overflow-wrap:break-word]">{product.name}</h1>

      {product.subtitle && <p className="mt-4 text-[19px] leading-relaxed text-exm-muted">{fixText(product.subtitle)}</p>}
      {product.description && !sameText(product.description, product.subtitle) && (
        <p className="mt-5 text-[16px] leading-relaxed text-exm-muted">{fixText(product.description)}</p>
      )}

      {meta.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-exm-line pt-6">
          {meta.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="technical text-[10px] text-exm-muted">{k}</dt>
              <dd className="mt-1 text-[14px] text-exm-text">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <ShopPrice p={product} size="large" showEnd />
        {!promo && !soon && Number(product.old_price) > 0 && <s className="text-exm-muted">{zl(product.old_price)}</s>}
      </div>

      {product.seats && !soon && <p className="mt-3"><SeatsLine p={product} /></p>}

      <InBundleLink product={product} />

      <div id="kup-teraz" className="mt-6 scroll-mt-28">
        <ProductActions
          product={product}
          qty={qty}
          setQty={setQty}
          onBuy={onBuy}
          onAdd={onAdd}
          added={added}
          onWaitlist={onWaitlist}
        />
      </div>

      {pay && (
        <p className="mt-4 text-[13px] leading-relaxed text-exm-muted">
          Bezpieczna płatność online przez PayU · potwierdzenie otrzymasz w wiadomości e-mail
        </p>
      )}

      {product.category === "mentoring" && linkUrl !== "/powrot" && (
        <p className="mt-6 text-[14px] text-exm-muted">
          Szukasz dłuższej pracy?{" "}
          <Link to="/powrot?src=produkt" className="text-exm-gold hover:underline">Poznaj program POWRÓT →</Link>
        </p>
      )}
    </div>
  );
}