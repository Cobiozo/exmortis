import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import ShopFilters, { FORM_OPTIONS, AUDIENCE_OPTIONS, AVAIL_OPTIONS } from "@/components/exmortis/shop/ShopFilters";
import ShopLevelSection from "@/components/exmortis/shop/ShopLevelSection";
import MusicSection from "@/components/exmortis/shop/MusicSection";
import TrustFooter from "@/components/exmortis/shop/TrustFooter";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";

const LEVELS = [
  { level: 0, label: "BRAMA", title: "Za darmo — zacznij tutaj", line: "Tu zaczyna większość ludzi." },
  { level: 1, label: "PIERWSZY KROK", title: "Pierwszy krok", line: "Słowa, które pomagają nazwać to, co czujesz." },
  { level: 2, label: "PRAKTYKA", title: "Praktyka", line: "Dla tych, którzy chcą iść samodzielnie — z mapą w ręku." },
  { level: 3, label: "KRĄG", title: "Krąg", line: "Wraca się łatwiej, kiedy ktoś idzie obok." },
  { level: 4, label: "GŁĘBIA", title: "Głębia", line: "Dla tych, którzy są gotowi na pracę jeden na jeden." },
];

const STAGE_WORDS = ["Śmierć", "Próg", "Powrót", "Inny"];
// Dostępne = można kupić / pobrać teraz; Oczekujące = zapowiedź z listą oczekujących.
const availOf = (p) => ((p.status || "dostępny") === "wkrótce" ? "Oczekujące" : "Dostępne");

// Moduł katalogu Skarbca; nagłówek i zachęta do testu są blokami w edytorze stron.
export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: null, form: null, audience: null, avail: null });
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

  // Katalog bez Listów powrotu, Testu i Minutnika ciszy — one mają własne podstrony.
  const visible = useMemo(
    () => products.filter((p) => !EXCLUDED_SLUGS.includes(p.slug)),
    [products]
  );

  // Filtry bez pustych opcji.
  const available = useMemo(
    () => ({
      avail: AVAIL_OPTIONS.filter((v) => visible.some((p) => availOf(p) === v)),
      stages: STAGE_WORDS.filter((s) => visible.some((p) => p.stage === s)),
      forms: FORM_OPTIONS.filter((f) => visible.some((p) => p.form === f)),
      audiences: AUDIENCE_OPTIONS.filter((a) =>
        visible.some((p) => Array.isArray(p.audience_tags) && p.audience_tags.includes(a))
      ),
    }),
    [visible]
  );

  const filtered = useMemo(() => {
    return visible.filter((p) => {
      if (filters.stage && p.stage !== "Wszystkie" && p.stage !== filters.stage) return false;
      if (filters.avail && availOf(p) !== filters.avail) return false;
      if (filters.form && p.form !== filters.form) return false;
      if (filters.audience) {
        const tags = Array.isArray(p.audience_tags) ? p.audience_tags : [];
        if (tags.length > 0 && !tags.includes(filters.audience)) return false;
      }
      return true;
    });
  }, [visible, filters]);

  const scrollToSections = () => {
    setTimeout(
      () => document.getElementById("poziom-0")?.scrollIntoView({ behavior: "smooth" }),
      60
    );
  };

  const emptyState = !loading && visible.length > 0 && filtered.length === 0;

  return (
    <div className="bg-[#0A0A0B]">
      <section className="px-5 md:px-10 pb-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap gap-x-10 gap-y-4 items-baseline">
            {available.stages.map((s) => (
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

      {/* ===== FILTRY ===== */}
      <ShopFilters filters={filters} setFilters={setFilters} available={available} />

      {/* ===== SEKCJE DRABINY ===== */}
      {loading ? (
        <div className="py-20 px-5 md:px-10">
          <div className="mx-auto max-w-[1400px] grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[380px] bg-[#0D0D0E] border hairline animate-pulse" />
            ))}
          </div>
        </div>
      ) : emptyState ? (
        <div className="py-32 text-center px-5">
          <p className="shop-heading text-2xl text-[#F5EFE1]/60">Nic tu jeszcze nie pasuje.</p>
          <p className="text-foreground/40 mt-4 mb-8">
            Spróbuj innych filtrów albo wyczyść wybór.
          </p>
          <button onClick={() => setFilters({ stage: null, form: null, audience: null, avail: null })} className="btn-ghost">
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
      <MusicSection products={visible} onWaitlist={setWaitlistProduct} />

      {/* ===== STOPKA ZAUFANIA ===== */}
      <TrustFooter />

      {waitlistProduct && (
        <WaitlistDialog product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />
      )}
    </div>
  );
}