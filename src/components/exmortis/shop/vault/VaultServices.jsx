import React from "react";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import { productHighlight } from "@/lib/productHighlight";
import { POWROT, ROZMOWA_NA_PROGU } from "@/lib/powrotOffer";
import ShopMedia from "./ShopMedia";
import ShopPrice from "./ShopPrice";

// Praca indywidualna — dwie osobne karty usług. Ceny z katalogu, parametry z jednego źródła oferty.
// Rozmowa na progu zawsze prowadzi do zgłoszenia; POWRÓT do strony programu (nigdy do koszyka).
const COPY = {
  [ROZMOWA_NA_PROGU.slug]: {
    line: "Krótkie zgłoszenie → płatność → wybór terminu",
    cta: "Umów Rozmowę na progu",
    note: "Osobna usługa, niezależna od programu POWRÓT.",
  },
  "powrot-mentoring": {
    line: `${POWROT.sessions} sesji po ${POWROT.lengthLong}, ${POWROT.cadence}. ${POWROT.months} pracy indywidualnej.`,
    cta: "Poznaj program POWRÓT",
    note: null,
  },
};

const hrefOf = (p) => (p.slug === "powrot-mentoring" ? "/powrot" : (p.checkout_url || "").trim() || `/skarbiec/${p.slug}`);

function ServiceCard({ p }) {
  const copy = COPY[p.slug] || { line: p.promise || "", cta: "Zobacz", note: null };
  const hl = productHighlight(p);
  return (
    <BrandCard
      variant="usługa"
      media={<ShopMedia product={p} />}
      highlight={hl ? <ProductHighlight kind={hl} /> : null}
      label={p.name}
      title={p.format || p.name}
      description={copy.line}
      meta={p.slug === "powrot-mentoring" ? `${POWROT.sessions} sesji · ${POWROT.months}` : p.format_details || p.format || null}
      action={
        <div className="space-y-3">
          <ShopPrice p={p} />
          <BrandButton to={hrefOf(p)} variant="secondary" className="w-full">{copy.cta}</BrandButton>
          {copy.note && <p className="text-[12px] leading-relaxed text-exm-muted">{copy.note}</p>}
        </div>
      }
    />
  );
}

// Użycie: <VaultServices products={[…]}> — karty tylko dla usług obecnych w katalogu.
export default function VaultServices({ products }) {
  const list = products || [];
  if (!list.length) return null;
  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      {list.map((p) => <ServiceCard key={p.id || p.slug} p={p} />)}
    </div>
  );
}