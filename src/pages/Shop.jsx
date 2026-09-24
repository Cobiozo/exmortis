import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ShopFilters from "@/components/exmortis/shop/ShopFilters";
import ShopLevelSection from "@/components/exmortis/shop/ShopLevelSection";
import MusicSection from "@/components/exmortis/shop/MusicSection";
import TrustFooter from "@/components/exmortis/shop/TrustFooter";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";

const LEVELS = [
  { level: 0, label: "BRAMA", title: "Za darmo — zacznij tutaj", line: "Tu zaczyna większość ludzi." },
  { level: 1, label: "PIERWSZY KROK", title: "Pierwszy krok", line: "Słowa, które pomagają nazwać to, co czujesz." },
  { level: 2, label: "PRAKTYKA", title: "Praktyka", line: "Dla tych, którzy chcą iść samodzielnie — z mapą w ręku." },
  { level: 3, label: "KRĄG", title: "Krąg", line: "Wraca się łatwiej, kiedy ktoś idzie obok." },
  { level: 4, label: "GŁĘBIA", title: "Głębia", line: "Dla tych, którzy są gotowi na pracę jeden na jeden." },
];

const STAGE_WORDS = ["Śmierć", "Próg", "Powrót", "Inny"];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: null, form: null, audience: null });
  const [waitlistProduct, setWaitlistProduct] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    base44.functions
      .invoke("shopProducts", {})
      .then((res) => setProducts(res.data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    base44.functions
      .invoke("eventsPublic", { action: "list" })
      .then((res) => {
        setEvents(
          (res.data.upcoming || []).filter(
            (e) =>
              e.status === "Opublikowane" &&
              Number(e.price) > 0 &&
              ["Warsztat", "Krąg", "Retreat"].includes(e.event_type)
          )
        );
      })
      .catch(() => setEvents([]));
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filters.stage && p.stage !== "Wszystkie" && p.stage !== filters.stage) return false;
      if (filters.form && p.form !== filters.form) return false;
      if (filters.audience) {
        const tags = Array.isArray(p.audience_tags) ? p.audience_tags : [];
        if (tags.length > 0 && !tags.includes(filters.audience)) return false;
      }
      return true;
    });
  }, [products, filters]);

  const scrollToSections = () => {
    setTimeout(
      () => document.getElementById("poziom-0")?.scrollIntoView({ behavior: "smooth" }),
      60
    );
  };

  const emptyState = !loading && products.length > 0 && filtered.length === 0;

  return (
    <div className="bg-[#0A0A0B] pt-20">
      {/* ===== NAGŁÓWEK ===== */}
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-20 px-5 md:px-10">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-6">SKARBIEC</p>
          <h1 className="shop-heading text-4xl md:text-7xl text-[#F5EFE1] leading-tight">
            Skarbiec — droga powrotu
          </h1>
          <p className="mt-8 text-foreground/60 text-lg leading-relaxed max-w-2xl">
            Powrót ma cztery etapy: <span className="gold-text">Śmierć · Próg · Powrót · Inny</span>.
            Na każdym z nich potrzeba innych narzędzi. Znajdziesz tu to, co pasuje do miejsca, w
            którym stoisz dzisiaj — od bezpłatnego listu po pracę jeden na jeden.
          </p>

          <div className="mt-16 flex flex-wrap gap-x-10 gap-y-4 items-baseline">
            {STAGE_WORDS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setFilters((f) => ({ ...f, stage: f.stage === s ? null : s }));
                  scrollToSections();
                }}
                className={`shop-heading text-3xl md:text-5xl transition-all duration-300 ${
                  filters.stage === s
                    ? "text-[#F5EFE1] border-b border-[#F5EFE1]/40 pb-1"
                    : "text-[#C9A24A] hover:opacity-70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NIE WIESZ, OD CZEGO ZACZĄĆ? ===== */}
      <section className="px-5 md:px-10 pb-14 md:pb-16">
        <div className="mx-auto max-w-[1400px] border border-[#5C1A1B]/60 bg-[#0D0D0E] p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <p className="technical text-[9px] text-foreground/40 mb-3">NIE WIESZ, OD CZEGO ZACZĄĆ?</p>
            <p className="text-foreground/70 text-lg leading-relaxed">
              Dwanaście pytań. Trzy minuty. Zobaczysz, z której śmierci dziś wracasz — i od czego
              warto zacząć.
            </p>
          </div>
          <Link to="/test" className="btn-relic flex-shrink-0">
            ZRÓB TEST <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ===== FILTRY ===== */}
      <ShopFilters filters={filters} setFilters={setFilters} />

      {/* ===== SEKCJE DRABINY ===== */}
      {loading ? (
        <div className="py-20 px-5 md:px-10">
          <div className="mx-auto max-w-[1400px] grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-[#0D0D0E] border hairline animate-pulse" />
            ))}
          </div>
        </div>
      ) : emptyState ? (
        <div className="py-32 text-center px-5">
          <p className="shop-heading text-2xl text-[#F5EFE1]/60">Nic tu jeszcze nie pasuje.</p>
          <p className="text-foreground/40 mt-4 mb-8">
            Spróbuj innych filtrów — albo zacznij od Listów powrotu.
          </p>
          <button onClick={() => setFilters({ stage: null, form: null, audience: null })} className="btn-ghost">
            WYCZYŚĆ FILTRY
          </button>
        </div>
      ) : (
        LEVELS.map((section) => (
          <ShopLevelSection
            key={section.level}
            section={section}
            products={filtered.filter((p) => (p.level ?? 1) === section.level)}
            events={events.filter((e) =>
              (section.level === 2
                ? ["Warsztat", "Retreat"]
                : section.level === 3
                  ? ["Krąg", "Retreat"]
                  : []
              ).includes(e.event_type)
            )}
            onWaitlist={setWaitlistProduct}
          />
        ))
      )}

      {/* ===== MUZYKA ===== */}
      <MusicSection products={products} onWaitlist={setWaitlistProduct} />

      {/* ===== STOPKA ZAUFANIA ===== */}
      <TrustFooter />

      {waitlistProduct && (
        <WaitlistDialog product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />
      )}
    </div>
  );
}