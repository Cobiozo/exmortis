import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/exmortis/ProductCard";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";
import { SectionHead } from "../parts";

// Moduł Skarbca: nagłówek i wstęp z bloku, produkty z zakładki Skarbiec (3 — wyróżnione najpierw).
export default function HomeSkarbiec({ d = {}, label }) {
  const [products, setProducts] = useState(null);
  useEffect(() => {
    base44.functions.invoke("shopProducts", {}).then((r) => setProducts(r.data.products)).catch(() => setProducts([]));
  }, []);
  const list = (products || []).filter((p) => !EXCLUDED_SLUGS.includes(p.slug))
    .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)).slice(0, 3);

  return (
    <section className="relative py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <SectionHead label={label} title={d.tytul} introHtml={d.tekst} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {products === null
            ? [...Array(3)].map((_, i) => <div key={i} className="aspect-square bg-card border hairline animate-pulse" />)
            : list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
        <div className="mt-12">
          <Link to="/skarbiec" className="btn-ghost">Cały Skarbiec <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}