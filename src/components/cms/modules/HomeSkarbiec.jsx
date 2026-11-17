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
  // Produkty zaznaczone w panelu „Pokaż na stronie głównej” (kolejność jak w Skarbcu), najwyżej 3.
  const list = (products || []).filter((p) => p.show_home && !EXCLUDED_SLUGS.includes(p.slug)).slice(0, 3);

  return (
    <section className="relative py-20 md:py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <SectionHead label={label} title={d.tytul} introHtml={d.tekst} />
        {/* Telefon: karty w poziomym pasku (przesuwane palcem) — strona główna krótsza o ok. 2 ekrany (audyt X-37). */}
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 sm:pb-0 [&>*]:shrink-0 [&>*]:w-[78%] sm:[&>*]:w-auto [&>*]:snap-start">
          {products === null
            ? [...Array(3)].map((_, i) => <div key={i} className="aspect-square bg-card border hairline animate-pulse" />)
            : list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
        <p className="sm:hidden mt-3 text-xs text-foreground/50">Przesuń w bok, żeby zobaczyć kolejne.</p>
        <div className="mt-8 md:mt-12">
          <Link to="/skarbiec" className="btn-ghost">Cały Skarbiec <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}