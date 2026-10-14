import { accessLabel, isDigital } from "@/components/account/accountUtils";
import React, { useEffect, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Minus, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/components/exmortis/CartContext";
import { Image } from "@/components/ui/image";
import FreeOrderForm from "@/components/exmortis/shop/FreeOrderForm";
import { useDocMeta } from "@/lib/useDocMeta";
import Logo from "@/components/exmortis/Logo";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";
import Curriculum from "@/components/exmortis/shop/Curriculum";
import ProductReviews from "@/components/exmortis/shop/ProductReviews";
import { isPromoActive, priceOnRequest, regularPrice, unitPrice, lowestPrice30, zl, nextPriceText } from "@/lib/productPrice";
import { GiftCardBuy } from "@/components/exmortis/shop/GiftCard";
import BundleBox from "@/components/exmortis/shop/BundleBox";
import { SeatsLine } from "@/components/exmortis/shop/cardBits";
import InBundleLink from "@/components/exmortis/shop/InBundleLink";
import { cardAmounts } from "@/components/exmortis/CartContext";
import JsonLd from "@/components/seo/JsonLd";
import { productJsonLd } from "@/lib/structuredData";

// Zmienione adresy produktów: stary → nowy.
const OLD_SLUGS = { "krag-mezczyzn-rzeszow": "krag-mezczyzn" };

// Porównanie tekstów bez znaczników, wielkości liter i odstępów — żeby to samo zdanie nie stało trzy razy pod sobą.
const sameText = (a, b) => {
  const n = (x) => String(x || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  useDocMeta(product?.name ? `${product.name} — Skarbiec | exmortis` : "", product?.subtitle || product?.description);

  useEffect(() => {
    if (OLD_SLUGS[slug]) { navigate(`/skarbiec/${OLD_SLUGS[slug]}`, { replace: true }); return; }
    setLoading(true);
    base44.functions
      .invoke("shopProducts", { slug })
      .then((res) => setProduct(res.data.products[0] || null))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAdd = () => {
    if (!product) return;
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] pt-20">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 gap-6">
        <p className="relic-heading text-4xl text-foreground/55">Nie znaleziono</p>
        <Link to="/skarbiec" className="btn-ghost">WRÓĆ DO SKLEPU</Link>
      </div>
    );
  }

  const soon = product.status === "wkrótce";
  const promo = !soon && !product.is_free && product.product_type !== "karta" && isPromoActive(product);
  const onRequest = !soon && priceOnRequest(product);
  const amounts = product.product_type === "karta" ? cardAmounts(product) : [];
  const linkUrl = (product.checkout_url || "").trim();
  const soldOut = !!product.seats && product.seats.left <= 0;

  return (
    <div className="bg-[#0A0A0B] pt-20">
      <JsonLd data={productJsonLd(product)} />
      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1400px] px-5 md:px-10 py-6">
        <button
          onClick={() => navigate("/skarbiec")}
          className="py-3 -my-3 technical text-[10px] text-foreground/50 hover:gold-text flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> SKLEP / {product.category.toUpperCase()}
        </button>
      </div>

      {/* Main */}
      <section className="mx-auto max-w-[1400px] px-5 md:px-10 pb-24">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          {/* Image */}
          <div className={`relative ${product.image_url ? "aspect-square" : "aspect-[16/9] md:aspect-square"} bg-card border hairline overflow-hidden`}>
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                className="w-full h-full"
                fittingType="fill"
              />
            ) : (
              // Bez zdjęcia: znak exmortis zamiast pustego pola.
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <Logo className="h-20 w-20 md:h-28 md:w-28 opacity-40" glow={false} />
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className="technical text-[9px] text-foreground/50 bg-[#0A0A0B]/70 px-2 py-1 border hairline">
                {product.category.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <p className="technical text-[11px] gold-text mb-4">{product.category.toUpperCase()} · ARTEFAKT</p>
            <h1 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-4 [overflow-wrap:break-word]">{product.name}</h1>
            {product.subtitle && (
              <p className="text-xl text-foreground/50 mb-8">{product.subtitle}</p>
            )}

            <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1 mb-8">
              <span className="font-mono text-4xl gold-text">
                {soon ? "Wkrótce" : product.is_free ? "Bezpłatnie" : amounts.length > 1 ? amounts.map((a) => `${a}`).join(" · ") + " zł" : onRequest ? "Po rozmowie" : `${unitPrice(product)} zł`}
              </span>
              {promo && (
                <span className="font-mono text-xl text-foreground/55 line-through">{regularPrice(product)} zł</span>
              )}
              {promo && (
                <span className="technical text-[10px] text-foreground/50">
                  DO {new Date(`${String(product.promo_end_date).slice(0, 10)}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long" }).toUpperCase()}
                </span>
              )}
              {!promo && !soon && Number(product.old_price) > 0 && (
                <span className="font-mono text-xl text-foreground/55 line-through">
                  {product.old_price} zł
                </span>
              )}
            </div>

            {promo && (
              <p className="text-xs text-foreground/50 -mt-6 mb-8">
                {nextPriceText(product) && <span className="block text-sm gold-text mb-1">{nextPriceText(product)}</span>}
                Najniższa cena z 30 dni przed obniżką: {zl(lowestPrice30(product))}
              </p>
            )}

            {product.seats && <p className="mb-6"><SeatsLine p={product} /></p>}

            <InBundleLink product={product} />

            {product.description && !sameText(product.description, product.subtitle) && (
              <p className="text-foreground/70 leading-relaxed text-lg mb-8">{product.description}</p>
            )}

            {product.long_description && !sameText(product.long_description, product.description) && !sameText(product.long_description, product.subtitle) &&
              (product.long_description.includes("<") ? (
                <div
                  className="rich-content text-foreground/60 leading-relaxed mb-8"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.long_description) }}
                />
              ) : (
                <p className="text-foreground/60 leading-relaxed mb-8 whitespace-pre-line">
                  {product.long_description}
                </p>
              ))}

            {/* Meta */}
            {(() => {
              const meta = [["FORMAT", product.format], ["CZAS", product.duration], ["MIEJSCA", product.spots]].filter(([, v]) => v);
              if (!meta.length) return null;
              return (
                <div className="grid grid-cols-2 gap-px bg-[#3D3D3F]/40 mb-8">
                  {meta.map(([k, v], i) => (
                    <div key={k} className={`bg-[#0A0A0B] p-4 ${meta.length % 2 === 1 && i === meta.length - 1 ? "col-span-2" : ""}`}>
                      <p className="technical text-[9px] text-foreground/55 mb-1">{k}</p>
                      <p className="text-sm">{v}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {(product.product_type === "kurs" || product.product_type === "wideo") && <Curriculum productId={product.id} />}

            {/* Details */}
            {product.details?.length > 0 && (
              <ul className="space-y-3 mb-10">
                {product.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-foreground/70">
                    <Check className="h-4 w-4 gold-text mt-1 flex-shrink-0" />
                    <span className="text-sm">{d}</span>
                  </li>
                ))}
              </ul>
            )}

            <BundleBox product={product} />

            {product.category === "mentoring" && linkUrl !== "/powrot" && (
              <Link to="/powrot" className="btn-ghost w-full mb-4">
                POZNAJ PROGRAM POWRÓT <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {/* Wkrótce: lista oczekujących. Z linkiem: przycisk. Darmowe: formularz. Po rozmowie: kontakt. Płatne: koszyk. */}
            {soon ? (
              <div className="mt-auto space-y-3">
                <button onClick={() => setWaitlist(true)} className="btn-relic w-full">
                  ZAPISZ SIĘ NA LISTĘ OCZEKUJĄCYCH <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-sm text-foreground/55">Ten materiał jeszcze powstaje. Napiszę, kiedy będzie gotowy.</p>
              </div>
            ) : soldOut ? (
              <div className="mt-auto space-y-3">
                <button disabled className="btn-relic w-full opacity-40 cursor-not-allowed">BRAK MIEJSC</button>
                <button onClick={() => setWaitlist(true)} className="btn-ghost w-full">
                  DAJ ZNAĆ, GDY ZWOLNI SIĘ MIEJSCE <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-sm text-foreground/55">
                  Limit miejsc został wykorzystany. Zostaw kontakt — napiszę, gdy zwolni się miejsce.
                </p>
              </div>
            ) : linkUrl && (product.is_free || onRequest) ? (
              <div className="mt-auto">
                {linkUrl.startsWith("/") ? (
                  <Link to={linkUrl} className="btn-relic w-full">{(product.button_label || (onRequest ? "Umów rozmowę" : "Zobacz")).toUpperCase()} <ArrowRight className="h-4 w-4" /></Link>
                ) : (
                  <a href={linkUrl} target="_blank" rel="noreferrer" className="btn-relic w-full">{(product.button_label || (onRequest ? "Umów rozmowę" : "Zobacz")).toUpperCase()} <ArrowRight className="h-4 w-4" /></a>
                )}
              </div>
            ) : product.is_free ? (
              <div className="mt-auto">
                <FreeOrderForm product={product} />
              </div>
            ) : product.product_type === "karta" ? (
              <GiftCardBuy product={product} />
            ) : onRequest ? (
              <div className="mt-auto">
                <Link to="/kontakt" className="btn-relic w-full">NAPISZ DO MNIE <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ) : (
              <div className="mt-auto space-y-4">
                {product.product_type === "pdf" && (
                  <p className="text-xs text-foreground/50">Plik jest osobisty — oznaczony Twoim adresem e-mail i numerem zamówienia.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center border hairline">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Mniej" className="p-3 text-foreground/60 hover:gold-text">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-5 font-mono" aria-live="polite">{qty}</span>
                    <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Więcej" className="p-3 text-foreground/60 hover:gold-text">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button onClick={handleAdd} className="btn-relic flex-1">
                    {added ? "DODANO ✓" : "DOŁĄCZ DO POWROTU"} {!added && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
                {isDigital(product) && <p className="text-sm text-foreground/60">{accessLabel(product)}</p>}
                <p className="technical text-[10px] text-foreground/55">
                  Sprzedaję z dojrzałości, nie z presji. Decyzję zostawiam Tobie.
                </p>
              </div>
            )}
          </div>
        </div>
        <ProductReviews productId={product.id} />
      </section>
      {waitlist && <WaitlistDialog product={product} onClose={() => setWaitlist(false)} />}
    </div>
  );
}