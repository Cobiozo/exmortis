import { invokeEarly } from "@/lib/earlyFetch";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/components/exmortis/CartContext";
import { useDocMeta } from "@/lib/useDocMeta";
import JsonLd from "@/components/seo/JsonLd";
import { productJsonLd } from "@/lib/structuredData";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";
import ProductCover from "@/components/exmortis/shop/detail/ProductCover";
import ProductPurchase from "@/components/exmortis/shop/detail/ProductPurchase";
import ProductDetails from "@/components/exmortis/shop/detail/ProductDetails";
import StickyBuyBar from "@/components/exmortis/shop/detail/StickyBuyBar";

// Zmienione adresy produktów: stary → nowy.
const OLD_SLUGS = { "krag-mezczyzn-rzeszow": "krag-mezczyzn" };

// Karta produktu (szablon CMS „produkt_tresc”): okładka i blok zakupu w dwóch kolumnach,
// pod nimi treść, opinie i powiązane produkty. Koszyk, kasa, lista oczekujących i pobieranie bez zmian.
export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, items: cartItems, setOpen: setCartOpen } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [waitlist, setWaitlist] = useState(false);

  useDocMeta(product?.name ? `${product.name} — Skarbiec | exmortis` : "", product?.subtitle || product?.description);

  useEffect(() => {
    if (OLD_SLUGS[slug]) { navigate(`/skarbiec/${OLD_SLUGS[slug]}`, { replace: true }); return; }
    setLoading(true);
    invokeEarly("shopProducts", { slug })
      .then((res) => {
        const p = res.data.products[0] || null;
        setProduct(p);
        if (p) track(FUNNEL.viewProduct, { slug: p.slug });
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // Produkt, którego nie ma: strona zgłasza 404 wyszukiwarkom (dopiero po zakończeniu ładowania).
  useEffect(() => {
    if (loading || product) return undefined;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [loading, product]);

  const handleAdd = () => {
    if (!product) return;
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Zakup od razu: produkt do koszyka (jeśli jeszcze go tam nie ma) i przejście do kasy.
  const handleBuy = () => {
    if (!product) return;
    if (!cartItems.some((i) => !i.key && i.id === product.id)) addItem(product, qty);
    setCartOpen(false);
    navigate("/kasa");
  };

  if (loading) {
    // min-h: stopka nie pojawia się na ekranie w trakcie ładowania (bez przesunięcia układu — CLS, 19.11.2026).
    return (
      <div className="min-h-[100svh] bg-exm-bg pt-20">
        <Section as="div" className="pt-10">
          <Container>
            <div className="grid gap-10 md:grid-cols-2 md:gap-16">
              <SkeletonBlock className="mx-auto aspect-[3/4] w-full max-w-[420px]" />
              <div>
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-6 h-12 w-3/4" />
                <SkeletonBlock className="mt-4 h-5 w-1/2" />
                <SkeletonBlock className="mt-8 h-9 w-32" />
                <SkeletonBlock className="mt-8 h-12 w-full" />
              </div>
            </div>
          </Container>
        </Section>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-exm-bg pt-20">
        <Section as="div">
          <Container>
            <EmptyState
              title="Nie znalazłem tego produktu"
              description="Ten adres nie prowadzi do żadnego materiału w Skarbcu."
              action={<BrandButton to="/skarbiec" variant="secondary">Wróć do Skarbca</BrandButton>}
            />
          </Container>
        </Section>
      </div>
    );
  }

  const soon = product.status === "wkrótce";
  const soldOut = !!product.seats && product.seats.left <= 0;
  const barLabel = soon ? "Powiadom mnie" : soldOut ? "Daj znać" : product.is_free ? "Odbierz" : "Kup teraz";
  const barAction = () => {
    if (soon || soldOut) { setWaitlist(true); return; }
    const el = document.getElementById("kup-teraz");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  return (
    <div className="bg-exm-bg pt-20">
      <JsonLd data={productJsonLd(product)} />

      <Section as="div">
        <Container>
          <button
            onClick={() => navigate("/skarbiec")}
            className="-my-3 flex min-h-11 items-center gap-2 py-3 text-[13px] text-exm-muted transition-colors hover:text-exm-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Skarbiec{product.category ? ` / ${product.category}` : ""}
          </button>

          <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-16">
            <ProductCover product={product} />
            <ProductPurchase
              product={product}
              qty={qty}
              setQty={setQty}
              onBuy={handleBuy}
              onAdd={handleAdd}
              added={added}
              onWaitlist={() => setWaitlist(true)}
            />
          </div>
        </Container>
      </Section>

      <ProductDetails product={product} />

      <div id="produkt-koniec" aria-hidden="true" />

      <StickyBuyBar product={product} label={barLabel} onAction={barAction} />

      {waitlist && <WaitlistDialog product={product} onClose={() => setWaitlist(false)} />}
    </div>
  );
}