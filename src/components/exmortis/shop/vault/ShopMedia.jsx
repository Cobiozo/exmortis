import React from "react";
import { Image } from "@/components/ui/image";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import { productSrcSet } from "@/lib/imgSrcSet";
import { cn } from "@/lib/utils";

// Okładka produktu w kadrze o stałych proporcjach: bez rozciągania i bez ucinania (contain),
// a przy braku grafiki — sygnet exmortis. Obraz wypełnia rodzica (rodzic ustawia proporcje).
// Użycie: <div className="relative aspect-[3/4]"><ShopMedia product={p} /></div>
// 19.11.2026 (szybkość): wersje 480/800 px przez srcset; priority = główny obraz strony
// (karta produktu, wyróżniona książka) — ładowany od razu i z wysokim priorytetem.
export default function ShopMedia({ product: p, className = "", priority = false, sizes = "(min-width: 1024px) 300px, (min-width: 640px) 40vw, 50vw" }) {
  const src = p?.cover_image || p?.image_url;
  const label = `Okładka: ${p?.name || "produkt"}`;
  if (!src) return <ImageFallback label={label} className={cn("absolute inset-0 h-full w-full", className)} />;
  const srcSet = productSrcSet(src);
  return (
    <Image
      src={src}
      alt={label}
      fittingType="fit"
      loading={priority ? "eager" : "lazy"}
      {...(priority ? { fetchpriority: "high" } : {})}
      {...(srcSet ? { srcSet, sizes } : {})}
      decoding="async"
      className={cn("absolute inset-0 h-full w-full", className)}
    />
  );
}
