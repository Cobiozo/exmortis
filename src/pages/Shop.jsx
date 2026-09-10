import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/exmortis/ProductCard";

const CATEGORIES = [
  { key: "all", label: "Wszystko" },
  { key: "darmowe", label: "Darmowe" },
  { key: "ebook", label: "Ebook" },
  { key: "warsztat", label: "Warsztat" },
  { key: "mentoring", label: "Mentoring" },
  { key: "mastermind", label: "Mastermind" },
  { key: "retreat", label: "Retreat" },
];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("all");

  useEffect(() => {
    base44.functions
      .invoke("shopProducts", {})
      .then((res) => setProducts(res.data.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (active === "all") return products;
    return products.filter((p) => p.category === active);
  }, [products, active]);

  return (
    <div className="bg-[#0A0A0B] pt-20">
      {/* Header */}
      <section className="relative py-24 md:py-32 px-5 md:px-10 border-b hairline">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-6">SKARBIEC · SKLEP</p>
          <h1 className="relic-heading text-5xl md:text-8xl leading-[0.9]">
            Droga<br /><span className="gold-text">powrotu</span>
          </h1>
          <p className="mt-8 text-foreground/60 text-lg max-w-xl leading-relaxed">
            Od darmowego zaufania do najgłębszej pracy. Każdy szczebel karmi następny.
            Sprzedaję z dojrzałości, nie z presji — decyzję zostawiam Tobie.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-20 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline">
        <div className="mx-auto max-w-[1400px] px-5 md:px-10 py-5 flex flex-wrap gap-2 md:gap-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`technical text-[10px] px-4 py-2 border transition-all duration-300 ${
                active === c.key
                  ? "border-[#C9A24A] gold-text bg-[#C9A24A]/5"
                  : "hairline text-foreground/50 hover:text-foreground/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 md:py-24 px-5 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-card border hairline animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32">
              <p className="relic-heading text-3xl text-foreground/40">Pusto tu</p>
              <p className="text-foreground/50 mt-4">Brak artefaktów w tej kategorii.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}