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
        <p className="relic-heading text-4xl text-foreground/40">Nie znaleziono</p>
        <Link to="/skarbiec" className="btn-ghost">WRÓĆ DO SKLEPU</Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0B] pt-20">
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
            <h1 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-4">{product.name}</h1>
            {product.subtitle && (
              <p className="text-xl text-foreground/50 mb-8">{product.subtitle}</p>
            )}

            <div className="flex items-baseline gap-4 mb-8">
              <span className="font-mono text-4xl gold-text">
                {!Number(product.price) ? (product.is_free === false ? "Po rozmowie" : "Bezpłatnie") : `${product.price} zł`}
              </span>
              {product.old_price && (
                <span className="font-mono text-xl text-foreground/30 line-through">
                  {product.old_price} zł
                </span>
              )}
            </div>

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
                      <p className="technical text-[9px] text-foreground/40 mb-1">{k}</p>
                      <p className="text-sm">{v}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

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

            {product.category === "mentoring" && (
              <Link to="/powrot" className="btn-ghost w-full">
                POZNAJ PROGRAM POWRÓT <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {/* Darmowe: formularz zamówienia. Płatne: koszyk. */}
            {product.is_free && !(product.checkout_url || "").trim() && product.status !== "wkrótce" ? (
              <div className="mt-auto">
                <FreeOrderForm product={product} />
              </div>
            ) : (
              <div className="mt-auto space-y-4">
                {product.product_type === "pdf" && (
                  <p className="text-xs text-foreground/50">Plik jest osobisty — oznaczony Twoim adresem e-mail i numerem zamówienia.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center border hairline">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3 text-foreground/60 hover:gold-text">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-5 font-mono">{qty}</span>
                    <button onClick={() => setQty((q) => q + 1)} className="p-3 text-foreground/60 hover:gold-text">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button onClick={handleAdd} className="btn-relic flex-1">
                    {added ? "DODANO ✓" : "DOŁĄCZ DO POWROTU"} {!added && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
                {isDigital(product) && <p className="text-sm text-foreground/60">{accessLabel(product)}</p>}
                <p className="technical text-[10px] text-foreground/40">
                  Sprzedaję z dojrzałości, nie z presji. Decyzję zostawiam Tobie.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}