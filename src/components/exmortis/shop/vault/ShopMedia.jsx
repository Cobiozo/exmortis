import React from "react";
import { Image } from "@/components/ui/image";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import { cn } from "@/lib/utils";

// Okładka produktu w kadrze o stałych proporcjach: bez rozciągania i bez ucinania (contain),
// a przy braku grafiki — sygnet exmortis. Obraz wypełnia rodzica (rodzic ustawia proporcje).
// Użycie: <div className="relative aspect-[3/4]"><ShopMedia product={p} /></div>
export default function ShopMedia({ product: p, className = "" }) {
  const src = p?.cover_image || p?.image_url;
  const label = `Okładka: ${p?.name || "produkt"}`;
  if (!src) return <ImageFallback label={label} className={cn("absolute inset-0 h-full w-full", className)} />;
  return (
    <Image
      src={src}
      alt={label}
      fittingType="fit"
      loading="lazy"
      className={cn("absolute inset-0 h-full w-full", className)}
    />
  );
}