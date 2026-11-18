import React from "react";
import useCatalog from "@/lib/useCatalog";
import VaultCard from "@/components/exmortis/shop/vault/VaultCard";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";

// Powiązane produkty: najwyżej trzy, najpierw z tej samej kategorii, potem z tego samego poziomu.
// Wyłącznie produkty dostępne teraz — zapowiedzi nie są propozycją zakupu.
export default function RelatedProducts({ product }) {
  const { products } = useCatalog();
  const all = products || [];
  const score = (p) => (p.category === product.category ? 2 : 0) + (p.level === product.level ? 1 : 0);
  const list = all
    .filter((p) => p.slug !== product.slug && p.status !== "wkrótce" && p.product_type !== "karta" && !EXCLUDED_SLUGS.includes(p.slug))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);

  if (!list.length) return null;

  return (
    <section className="mt-16 border-t border-exm-line pt-12">
      <h2 className="exm-h2">Zobacz też</h2>
      <div className="mt-6 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => <VaultCard key={p.id || p.slug} product={p} />)}
      </div>
    </section>
  );
}