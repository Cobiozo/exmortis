import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import ShopFilters, { FORM_OPTIONS, AUDIENCE_OPTIONS, AVAIL_OPTIONS } from "@/components/exmortis/shop/ShopFilters";
import ShopLevelSection from "@/components/exmortis/shop/ShopLevelSection";
import ShopSoonSection from "@/components/exmortis/shop/ShopSoonSection";
import MusicSection from "@/components/exmortis/shop/MusicSection";
import TrustFooter from "@/components/exmortis/shop/TrustFooter";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";
import { ShopViewToggle, loadShopView, saveShopView } from "@/components/exmortis/shop/ShopCompactViews";
import { ArrowRight } from "lucide-react";

const LEVELS = [
  { level: 0, label: "BRAMA", title: "Za darmo — zacznij tutaj", line: "Tu zaczyna większość ludzi." },
  { level: 1, label: "PIERWSZY KROK", title: "Pierwszy krok", line: "Słowa, które pomagają nazwać to, co czujesz." },
  { level: 2, label: "PRAKTYKA", title: "Praktyka", line: "Dla tych, którzy chcą iść samodzielnie — z mapą w ręku." },
  { level: 3, label: "KRĄG", title: "Krąg", line: "Wraca się łatwiej, kiedy ktoś idzie obok." },
  { level: 4, label: "GŁĘBIA", title: "Głębia", line: "Dla tych, którzy są gotowi na pracę jeden na jeden." },
];

const STAGE_WORDS = ["Śmierć", "Próg", "Powrót", "Inny"];

// Kolejność sekcji „Za darmo — zacznij tutaj” (reszta katalogu idzie kolejnością z bazy).
// Dwa produkty mają w bazie ten sam sort_order, a bez daty utworzenia kolejność remisu jest
// nieprzewidywalna — ta lista trzyma układ ustalony dla marki.
const FREE_ORDER = [
  "kiedy-kto-bliski-ga-nie-mini",
  "3-pierwsze-ruchy",
  "listy-powrotu",
  "kanal-whatsapp",
  "podcast-exmortis",
  "muzyka-powrotu",
  "minutnik-ciszy",
];
const freeRank = (p) => {
  const i = FREE_ORDER.indexOf(p.slug);
  return i < 0 ? FREE_ORDER.length : i;
};
// Dostępne = można kupić / pobrać teraz; Oczekujące = zapowiedź z listą oczekujących.
const availOf = (p) => ((p.status || "dostępny") === "wkrótce" ? "Oczekujące" : "Dostępne");

// Moduł katalogu Skarbca; nagłówek i zachęta do testu są blokami w edytorze stron.
export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: null, form: null, audience: null, avail: null });
  const [waitlistProduct, setWaitlistProduct] = useState(null);
  const [events, setEvents] = useState([]);
  const [view, setView] = useState(loadShopView);
  // Zakładki: „Dostępne teraz” (domyślnie) i „W przygotowaniu” (zapowiedzi z listą powiadomień).
  const [tab, setTab] = useState("dostepne");
  const changeView = (v) => { setView(v); saveShopView(v); };

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

  // Katalog bez Testu i soundtracku — one mają własne miejsca (blok testu nad katalogiem, sekcja MUZYKA).
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
    const list = visible.filter((p) => {
      if (filters.stage && p.stage !== "Wszystkie" && p.stage !== filters.stage) return false;
      if (filters.avail && availOf(p) !== filters.avail) return false;
      if (filters.form && p.form !== filters.form) return false;
      if (filters.audience) {
        const tags = Array.isArray(p.audience_tags) ? p.audience_tags : [];
        if (tags.length > 0 && !tags.includes(filters.audience)) return false;
      }
      return true;
    });
    // Poziom zostaje poziomem; w obrębie sekcji darmowej — ustalona kolejność, reszta bez zmian.
    return list.sort((a, b) => ((a.level ?? 1) - (b.level ?? 1)) || (freeRank(a) - freeRank(b)));
  }, [visible, filters]);

  // Dostępne idą drabiną poziomów; zapowiedzi („wkrótce”) zbieramy niżej, w jednej sekcji.
  const isSoon = (p) => (p.status || "dostępny") === "wkrótce";
  const buyable = useMemo(() => filtered.filter((p) => !isSoon(p)), [filtered]);
  const soon = useMemo(() => filtered.filter(isSoon), [filtered]);

  const scrollTo = (id) => {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  // Trzy drogi: liczone z tego, co naprawdę jest dostępne (bez filtrów). Pusta droga prowadzi do zapowiedzi.
  const ready = useMemo(() => visible.filter((p) => !isSoon(p)), [visible]);
  const paths = [
    { key: "free", title: "Zacznij bezpłatnie", line: "Materiały na pierwszy krok — bez opłat.", levels: [0], target: "poziom-0" },
    { key: "self", title: "Pracuj samodzielnie", line: "Książki, kursy i praktyki we własnym tempie.", levels: [1, 2], target: "poziom-1" },
    { key: "mentor", title: "Porozmawiaj o mentoringu", line: "Praca jeden na jeden. Zaczynamy od rozmowy.", levels: [4], target: "poziom-4" },
  ].map((d) => ({ ...d, count: ready.filter((p) => d.levels.includes(p.level ?? 1)).length }));
  const goPath = (d) => {
    setFilters({ stage: null, form: null, audience: null, avail: null });
    if (d.count > 0) {
      setTab("dostepne");
      const lvl = d.levels.find((l) => ready.some((p) => (p.level ?? 1) === l));
      scrollTo(`poziom-${lvl}`);
    } else {
      setTab("przygotowanie");
      scrollTo("skarbiec-katalog");
    }
  };

  const shown = tab === "dostepne" ? buyable : soon;
  const hasFilters = !!(filters.stage || filters.form || filters.audience);
  const emptyState = !loading && visible.length > 0 && shown.length === 0 && (tab === "dostepne" ? events.length === 0 || hasFilters : true);

  return (
    <div className="bg-[#0A0A0B]">
      {/* ===== TRZY DROGI ===== */}
      <section className="px-5 md:px-10 pb-10">
        <div className="mx-auto max-w-[1400px] grid sm:grid-cols-3 gap-3 md:gap-4">
          {paths.map((d, i) => (
            <button key={d.key} onClick={() => goPath(d)}
              className="group text-left border hairline bg-[#0D0D0E] p-5 md:p-6 hover:border-[#C9A24A]/60 transition-colors flex flex-col">
              <span className="technical text-[10px] gold-text mb-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="shop-heading text-xl md:text-2xl text-[#F5EFE1] leading-snug">{d.title}</span>
              <span className="text-sm text-foreground/60 mt-2">{d.line}</span>
              <span className="technical text-[10px] mt-4 inline-flex items-center gap-1.5 text-foreground/70 group-hover:gold-text">
                {loading ? "…" : d.count > 0 ? `DOSTĘPNE: ${d.count}` : "PIERWSZE MATERIAŁY W PRZYGOTOWANIU"} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== ZAKŁADKI ===== */}
      <div id="skarbiec-katalog" className="px-5 md:px-10 scroll-mt-24">
        <div className="mx-auto max-w-[1400px] flex flex-wrap gap-2" role="tablist" aria-label="Dostępność materiałów">
          {[["dostepne", "DOSTĘPNE TERAZ", ready.length], ["przygotowanie", "W PRZYGOTOWANIU", visible.length - ready.length]].map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`technical text-[10px] px-4 py-2.5 min-h-11 border transition-colors ${tab === k ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10" : "hairline text-foreground/55 hover:text-foreground"}`}>
              {label}{loading ? "" : ` (${n})`}
            </button>
          ))}
        </div>
      </div>

      {/* ===== FILTRY ===== */}
      <ShopFilters filters={filters} setFilters={setFilters} available={available} extra={<ShopViewToggle view={view} onChange={changeView} />} />

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
        <div className="py-24 text-center px-5">
          <p className="shop-heading text-2xl text-[#F5EFE1]/60">
            {hasFilters ? "Żaden materiał nie pasuje do wybranych filtrów." : tab === "dostepne" ? "Materiały pojawią się tu wkrótce." : "Nic nie jest teraz w przygotowaniu."}
          </p>
          {hasFilters && (
            <>
              <p className="text-foreground/55 mt-4 mb-8">
                Zmień albo wyczyść filtry{tab === "dostepne" ? " — możesz też zajrzeć do zakładki „W przygotowaniu”" : ""}.
              </p>
              <button onClick={() => setFilters({ stage: null, form: null, audience: null, avail: null })} className="btn-ghost">
                WYCZYŚĆ FILTRY
              </button>
            </>
          )}
        </div>
      ) : tab === "przygotowanie" ? (
        <ShopSoonSection products={soon} onWaitlist={setWaitlistProduct} view={view} />
      ) : (
        <>
        {LEVELS.map((section) => (
          <ShopLevelSection
            key={section.level}
            section={section}
            products={buyable.filter((p) => (p.level ?? 1) === section.level)}
            events={events.filter((e) =>
              (section.level === 2
                ? ["Warsztat", "Retreat"]
                : section.level === 3
                  ? ["Krąg", "Retreat"]
                  : []
              ).includes(e.event_type)
            )}
            onWaitlist={setWaitlistProduct}
            view={view}
          />
        ))}
        </>
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