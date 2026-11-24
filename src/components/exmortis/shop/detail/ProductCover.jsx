import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductThumbs from "./ProductThumbs";
import Logo from "@/components/exmortis/Logo";
import PaperCard from "@/components/exmortis/ui/PaperCard";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import ShopMedia from "@/components/exmortis/shop/vault/ShopMedia";
import { productHighlight } from "@/lib/productHighlight";
import { cn } from "@/lib/utils";

// Okładka na karcie produktu: książka i materiał cyfrowy na papierze (3:4), usługa w kadrze 4:3.
// Znaczek wyróżnienia w lewym górnym rogu; bez grafiki — sygnet exmortis.
// self-start: karta ma wysokość okładki, a nie całej kolumny z opisem zakupu (bez pustego pola pod okładką, 19.11.2026).
const BOOK_TYPES = ["pdf", "audio", "kurs", "wideo", "zestaw", "pakiet"];

export default function ProductCover({ product }) {
  const hl = productHighlight(product);
  const book = BOOK_TYPES.includes(product.product_type);
  const cover = product.image_url || product.cover_image || "";
  // Zdjęcie główne + galeria z panelu (bez powtórzeń i pustych adresów).
  const images = [...new Set([cover, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean))];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [product.id]);
  const src = images[active] || "";
  const go = (d) => setActive((i) => (i + d + images.length) % images.length);

  const frame = (
    <div className={cn("relative overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2", book ? "aspect-[3/4]" : "aspect-[4/3]")}>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Poprzednie zdjęcie" className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-exm-bg/70 text-exm-ivory hover:text-exm-gold">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Następne zdjęcie" className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-exm-bg/70 text-exm-ivory hover:text-exm-gold">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      {src ? (
        <ShopMedia product={{ ...product, cover_image: src }} priority={active === 0} sizes="(min-width: 1024px) 420px, 90vw" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Logo className="h-20 w-20 opacity-40" glow={false} />
        </span>
      )}
      {hl && (
        <div className="absolute left-3 top-3">
          <ProductHighlight kind={hl} />
        </div>
      )}
    </div>
  );

  const thumbs = images.length > 1 && <ProductThumbs images={images} active={active} onPick={setActive} name={product.name} />;

  return book ? (
    <div className="mx-auto h-fit w-full max-w-[420px] self-start">
      <PaperCard className="p-3 md:p-4">{frame}</PaperCard>
      {thumbs}
    </div>
  ) : (
    <div className="mx-auto h-fit w-full max-w-[520px] self-start">{frame}{thumbs}</div>
  );
}