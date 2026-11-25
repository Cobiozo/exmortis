import { invokeEarly } from "@/lib/earlyFetch";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackageX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";
import TrustFooter from "@/components/exmortis/shop/TrustFooter";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";
import VaultTabs from "@/components/exmortis/shop/vault/VaultTabs";
import VaultCard from "@/components/exmortis/shop/vault/VaultCard";
import VaultFeatured from "@/components/exmortis/shop/vault/VaultFeatured";
import VaultServices from "@/components/exmortis/shop/vault/VaultServices";
import VaultSoon from "@/components/exmortis/shop/vault/VaultSoon";
import { isNewProduct, newSortKey } from "@/lib/productHighlight";
import { unitPrice } from "@/lib/productPrice";

// Skarbiec (etap 4): krótki nagłówek z bloku strony, pod nim jedna wskazówka, zakładki grup
// i jeden czytelny widok kart. Kupno, kasa, lista oczekujących i pobieranie — bez zmian.
const BOOK = "wracam-inny";
const isSoon = (p) => (p.status || "dostępny") === "wkrótce";

// Ustalona kolejność materiałów bezpłatnych (reszta idzie kolejnością z bazy).
const FREE_ORDER = [
  "kiedy-ktos-bliski-gasnie-mini",
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

// Grupy produktów — tylko te, które mają pozycje. Karta podarunkowa zawsze w „Prezencie”.
const buildGroups = (list) =>
  [
    // Nowości — pierwsza i domyślnie otwarta zakładka (Dawid 25.11.2026).
    { key: "nowosci", label: "Nowości", items: list.filter((p) => !isSoon(p) && isNewProduct(p)).sort((a, b) => newSortKey(b) - newSortKey(a)) },
    { key: "bezplatnie", label: "Bezpłatnie", items: list.filter((p) => p.is_free && !isSoon(p)).sort((a, b) => freeRank(a) - freeRank(b)) },
    { key: "ksiazki", label: "Książki", items: list.filter((p) => !p.is_free && !isSoon(p) && p.product_type !== "usluga" && p.product_type !== "karta") },
    { key: "praca", label: "Praca indywidualna", items: list.filter((p) => !p.is_free && !isSoon(p) && p.product_type === "usluga") },
    { key: "prezent", label: "Prezent", items: list.filter((p) => p.product_type === "karta") },
    { key: "zapowiedzi", label: "Zapowiedzi", items: list.filter(isSoon) },
  ].filter((g) => g.items.length > 0);

const GRID = "grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default function Shop() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(null);
  const [waitlistProduct, setWaitlistProduct] = useState(null);

  const load = useCallback(() => {
    setError(false);
    setProducts(null);
    invokeEarly("shopProducts", {})
      .then((res) => setProducts(res?.data?.products || []))
      .catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (products || []).filter((p) => !EXCLUDED_SLUGS.includes(p.slug)),
    [products]
  );
  const groups = useMemo(() => buildGroups(visible), [visible]);
  const active = tab && groups.some((g) => g.key === tab) ? tab : groups[0]?.key;
  const current = groups.find((g) => g.key === active);
  // Wyróżnione nad zakładkami: dostępne płatne książki od najtańszej (Dawid 25.11.2026: najpierw
  // „Kiedy wreszcie…?” za 19 zł, pod nią „Wracam inny”). Przy tej samej cenie „Wracam inny” wyżej.
  const featured = useMemo(() => {
    const books = groups.find((g) => g.key === "ksiazki")?.items || [];
    const price = (p) => { const v = Number(unitPrice(p)); return Number.isFinite(v) ? v : Infinity; };
    return [...books].sort((a, b) => price(a) - price(b) || (b.slug === BOOK) - (a.slug === BOOK));
  }, [groups]);

  const panel = () => {
    if (!current) return null;
    if (current.key === "praca") return <VaultServices products={current.items} />;
    if (current.key === "zapowiedzi") return <VaultSoon products={current.items} onWaitlist={setWaitlistProduct} />;
    return (
      <div className={GRID}>
        {current.items.map((p) => <VaultCard key={p.id || p.slug} product={p} />)}
      </div>
    );
  };

  return (
    <div className="bg-exm-bg">
      {/* Katalog stoi tuż pod nagłówkiem strony (blok CMS) — bez drugiego pełnego odstępu sekcji nad wskazówką. */}
      <Section className="!pt-2 md:!pt-4">
        <Container>
          <p className="text-[15px] leading-relaxed text-exm-muted">
            Nie wiesz, od czego zacząć?{" "}
            <Link
              to="/test?src=skarbiec"
              className="text-exm-gold underline decoration-exm-gold-line underline-offset-4 transition-colors hover:text-exm-gold-hover"
            >
              Zrób test
            </Link>
          </p>

          {products === null && !error && (
            <div className={`${GRID} mt-8`}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-4">
                  <SkeletonBlock className="aspect-[3/4] w-full" rounded="var(--exm-r-field)" />
                  <SkeletonBlock className="mt-4 h-5 w-2/3" />
                  <SkeletonBlock className="mt-2 h-4 w-1/3" />
                  <SkeletonBlock className="mt-6 h-11 w-full" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-8">
              <EmptyState
                icon={<PackageX />}
                title="Nie udało się wczytać Skarbca"
                description="Sprawdź połączenie i spróbuj jeszcze raz."
                action={<BrandButton variant="secondary" onClick={load}>Spróbuj ponownie</BrandButton>}
              />
            </div>
          )}

          {products !== null && groups.length === 0 && (
            <div className="mt-8">
              <EmptyState
                icon={<PackageX />}
                title="Skarbiec jest w przygotowaniu"
                description="Materiały pojawią się tutaj — wróć za chwilę."
                action={<BrandButton to="/test?src=skarbiec" variant="secondary">Zrób test</BrandButton>}
              />
            </div>
          )}

          {groups.length > 0 && (
            <>
              {/* Lejek 19.11.2026: wyróżniona książka stoi nad zakładkami — płatna oferta nie wisi pod aktywną zakładką „Bezpłatnie”. */}
              {featured.length > 0 && (
                <div className="mt-8 space-y-6 md:mt-10">
                  <h2 className="sr-only">Wyróżnione książki</h2>
                  {featured.map((p) => <VaultFeatured key={p.id || p.slug} product={p} />)}
                </div>
              )}

              <div className="mt-10 md:mt-14">
                <VaultTabs
                  tabs={groups.map((g) => ({ key: g.key, label: g.label, count: g.items.length }))}
                  value={active}
                  onChange={setTab}
                />
              </div>

              <div
                role="tabpanel"
                id={`vault-panel-${active}`}
                aria-labelledby={`vault-tab-${active}`}
                tabIndex={0}
                className="mt-8 md:mt-10 focus:outline-none"
              >
                <h2 className="sr-only">{current.label}</h2>
                {panel()}
              </div>
            </>
          )}
        </Container>
      </Section>

      <TrustFooter />

      {waitlistProduct && (
        <WaitlistDialog product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />
      )}
    </div>
  );
}