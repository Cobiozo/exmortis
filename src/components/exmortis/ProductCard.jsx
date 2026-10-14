import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { isPromoActive, priceOnRequest, regularPrice, unitPrice, lowestPrice30, zl } from "@/lib/productPrice";

// Karta produktu na stronie głównej (Skarbiec).
export default function ProductCard({ product, index = 0 }) {
  const sameAsSubtitle =
    product.subtitle &&
    (product.description || "").trim() === product.subtitle.trim();

  return (
    <div className="group relative bg-card border hairline overflow-hidden transition-all duration-500 hover:border-[#C9A24A]/60">
      <Link to={`/skarbiec/${product.slug}`} className="block">
        {product.image_url ? (
          <div className="relative aspect-square overflow-hidden bg-[#0A0A0B]">
            <Image
              src={product.image_url}
              alt={product.name}
              className="w-full h-full transition-transform duration-700 group-hover:scale-105"
              fittingType="fill"
            />
            <div className="absolute top-4 left-4">
              <span className="technical text-[9px] text-foreground/55 bg-[#0A0A0B]/70 px-2 py-1 border hairline">
                {String(index + 1).padStart(2, "0")} · {product.category}
              </span>
            </div>
          </div>
        ) : null}

        <div className="p-6 space-y-4">
          {!product.image_url && (
            <span className="technical text-[9px] text-foreground/55 block">
              {String(index + 1).padStart(2, "0")} · {product.category}
            </span>
          )}
          <div>
            <h3 className="relic-heading text-lg gold-text">{product.name}</h3>
            {product.subtitle && (
              <p className="text-sm text-foreground/55 mt-1">{product.subtitle}</p>
            )}
          </div>
          {product.description && !sameAsSubtitle && (
            <p className="text-sm text-foreground/60 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <div className="flex items-center justify-between pt-4 border-t hairline">
            <span className="font-mono text-lg text-foreground">
              {product.status === "wkrótce" ? "WKRÓTCE"
                : product.is_free ? "DARMOWE"
                : priceOnRequest(product) ? "PO ROZMOWIE"
                : isPromoActive(product)
                  ? <><s className="text-foreground/55 text-sm mr-2">{regularPrice(product)} zł</s>{unitPrice(product)} zł</>
                  : `${unitPrice(product)} zł`}
            </span>
            <span className="technical text-[10px] text-foreground/55 group-hover:gold-text flex items-center gap-1 transition-colors">
              ZOBACZ <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          {product.status !== "wkrótce" && !product.is_free && isPromoActive(product) && (
            <p className="text-[11px] text-foreground/55 -mt-2">Najniższa cena z 30 dni przed obniżką: {zl(lowestPrice30(product))}</p>
          )}
        </div>
      </Link>

      {product.category === "mentoring" && (
        <Link
          to="/powrot"
          className="flex items-center justify-between px-6 py-4 border-t hairline technical text-[10px] gold-text hover:bg-[#C9A24A]/10 transition-colors"
        >
          POZNAJ PROGRAM POWRÓT <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}