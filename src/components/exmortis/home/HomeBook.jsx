import React from "react";
import { Image } from "@/components/ui/image";
import { productSrcSet } from "@/lib/imgSrcSet";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import ShopPrice from "@/components/exmortis/shop/vault/ShopPrice";
import useCatalog from "@/lib/useCatalog";
import { track } from "@/lib/track";
import { productHighlight } from "@/lib/productHighlight";

// Książka na stronie głównej (lejek 19.11.2026): pierwszy płatny krok po bezpłatnym spotkaniu.
// Okładka, opis, format i cena wyłącznie z katalogu (shopProducts) — ta sama cena co w Skarbcu i w kasie.
const DOMYSLNA = "wracam-inny";
const format = (p) => (p?.format ? `Ebook · ${String(p.format).replace(/,\s*/g, " · ")}` : "Ebook · PDF");

export default function HomeBook({ d = {}, label }) {
  const { products, bySlug } = useCatalog();
  const slug = d.produkt || DOMYSLNA;
  const book = bySlug(slug);
  // Katalog się ładuje → zarezerwowane miejsce; produktu brak lub ukryty → sekcja znika.
  if (products && (!book || book.active === false)) return null;
  const okladka = book?.image_url || book?.cover_image || "";
  const highlight = productHighlight(book);
  const link = `/skarbiec/${slug}?src=home-ksiazka`;

  return (
    <Section tone="surface">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-14">
          <div className="md:col-span-5 lg:col-span-4">
            <div className="mx-auto w-full max-w-[220px] sm:max-w-[280px] overflow-hidden rounded-[var(--exm-r-field)] border border-exm-line shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] md:max-w-[340px]">
              {okladka
                ? <Image src={okladka} alt={`Okładka książki ${book?.name || "Wracam inny"}`} fittingType="fill" className="aspect-[3/4] w-full"
                    loading="lazy" decoding="async" {...(productSrcSet(okladka) ? { srcSet: productSrcSet(okladka), sizes: "(min-width: 768px) 340px, (min-width: 640px) 280px, 220px" } : {})} />
                : <ImageFallback label="Okładka książki" className="aspect-[3/4] w-full" />}
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-8">
            <SectionHeader
              eyebrow={d.etykieta || label || "KSIĄŻKA"}
              title={d.tytul || book?.name || "Wracam inny"}
              lead={d.tekst || book?.subtitle || ""}
            />
            {book?.description && <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-exm-muted">{book.description}</p>}
            {book?.for_whom && <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-exm-muted">{book.for_whom}</p>}

            <div className="mt-8 border-t border-exm-line pt-6">
              <div className="flex flex-wrap items-center gap-3">
                {highlight && <ProductHighlight kind={highlight} />}
                <p className="technical text-[10px] leading-relaxed text-exm-muted">{format(book)}</p>
              </div>
              {book && <ShopPrice p={book} size="large" showEnd className="mt-3" />}
              <div className="mt-7">
                <BrandButton to={link} className="w-full sm:w-auto" onClick={() => track("home_ksiazka_click", { produkt: slug })}>
                  {d.przycisk || "Poznaj książkę"}
                </BrandButton>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
