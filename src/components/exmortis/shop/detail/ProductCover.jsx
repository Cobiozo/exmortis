import React from "react";
import Logo from "@/components/exmortis/Logo";
import PaperCard from "@/components/exmortis/ui/PaperCard";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import ShopMedia from "@/components/exmortis/shop/vault/ShopMedia";
import { productHighlight } from "@/lib/productHighlight";
import { cn } from "@/lib/utils";

// Okładka na karcie produktu: książka i materiał cyfrowy na papierze (3:4), usługa w kadrze 4:3.
// Znaczek wyróżnienia w lewym górnym rogu; bez grafiki — sygnet exmortis.
const BOOK_TYPES = ["pdf", "audio", "kurs", "wideo", "pakiet"];

export default function ProductCover({ product }) {
  const hl = productHighlight(product);
  const book = BOOK_TYPES.includes(product.product_type);
  const src = product.image_url || product.cover_image || "";

  const frame = (
    <div className={cn("relative overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2", book ? "aspect-[3/4]" : "aspect-[4/3]")}>
      {src ? (
        <ShopMedia product={{ ...product, cover_image: src }} />
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

  return book ? (
    <PaperCard className="mx-auto w-full max-w-[420px] p-3 md:p-4">{frame}</PaperCard>
  ) : (
    <div className="mx-auto w-full max-w-[520px]">{frame}</div>
  );
}