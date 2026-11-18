import React from "react";
import { Image } from "@/components/ui/image";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import useCatalog from "@/lib/useCatalog";
import { track } from "@/lib/track";
import { isPromoActive, unitPrice, regularPrice, lowestPrice30, zl, priceOnRequest } from "@/lib/productPrice";
import { productHighlight } from "@/lib/productHighlight";
import { POWROT, ROZMOWA_NA_PROGU } from "@/lib/powrotOffer";

// „Wybierz swój pierwszy krok” (etap 2, 18.11.2026): trzy równe karty, przycisk na dole każdej.
// Ceny, format i okładka książki pochodzą z katalogu (shopProducts) — nigdy z tekstu w kodzie.
const BOOK = "wracam-inny";
const TALK = "rozmowa-na-progu";
const POWROT_PRODUCT = "powrot-mentoring";

const cena = (p, fallback) => (p && !priceOnRequest(p) && unitPrice(p) > 0 ? zl(unitPrice(p)) : fallback);
const opisFormatu = (p) => (p?.format ? `Ebook · ${String(p.format).replace(/,\s*/g, " · ")}` : "Ebook · PDF");

export default function StartPaths({ d = {}, label }) {
  const { bySlug } = useCatalog();
  const book = bySlug(BOOK);
  const talk = bySlug(TALK);
  const powrot = bySlug(POWROT_PRODUCT);
  const promo = isPromoActive(book);
  const highlight = productHighlight(book);
  const okladka = book?.image_url || book?.cover_image || "";

  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow={d.etykieta || label || "WYBIERZ SWÓJ PIERWSZY KROK"}
          title={d.tytul || "Wybierz swój pierwszy krok"}
          lead={d.tekst || "Możesz zacząć bezpłatnie, sięgnąć po książkę albo umówić rozmowę. Każda z tych dróg prowadzi w to samo miejsce — do siebie."}
        />

        <div className="mt-10 grid items-stretch gap-5 md:mt-14 md:grid-cols-3 md:gap-6">
          <BrandCard
            variant="usługa"
            label="BEZPŁATNIE"
            title="Zacznij bezpłatnie"
            description="Test autorefleksji, otwarte spotkanie, bezpłatne materiały i podcast."
            action={
              <BrandButton
                to="/zacznij?src=home"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => track("home_start_click", { cel: "bezplatnie" })}
              >
                Zobacz bezpłatne materiały
              </BrandButton>
            }
          />

          <BrandCard
            variant="usługa"
            label="WE WŁASNYM TEMPIE"
            title="Wracam inny"
            action={
              <BrandButton
                to={`/skarbiec/${BOOK}`}
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => track("home_start_click", { cel: "ksiazka" })}
              >
                Poznaj książkę
              </BrandButton>
            }
          >
            <div className="mt-1 flex items-start gap-4">
              <div className="w-[76px] shrink-0 overflow-hidden rounded-[var(--exm-r-field)] border border-exm-line">
                {okladka
                  ? <Image src={okladka} alt={book?.name || "Wracam inny"} fittingType="fill" className="aspect-[3/4] w-full" />
                  : <ImageFallback label="Okładka książki Wracam inny" className="aspect-[3/4] w-full" />}
              </div>
              <div className="min-w-0">
                {highlight && <ProductHighlight kind={highlight} className="mb-2" />}
                <p className="technical text-[10px] leading-relaxed text-exm-muted">{opisFormatu(book)}</p>
                {book && (
                  promo ? (
                    <div className="mt-2">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm text-exm-muted line-through">{zl(regularPrice(book))}</span>
                        <span className="font-exm-serif text-2xl text-exm-gold">{zl(unitPrice(book))}</span>
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-exm-muted">Najniższa cena z 30 dni: {zl(lowestPrice30(book))}</p>
                    </div>
                  ) : (
                    <p className="mt-2 font-exm-serif text-2xl text-exm-gold">{zl(unitPrice(book))}</p>
                  )
                )}
              </div>
            </div>
          </BrandCard>

          <BrandCard
            variant="usługa"
            label="OSOBIŚCIE, 1:1"
            title="Współpraca indywidualna"
            action={
              <BrandButton href="#wspolpraca" variant="secondary" className="w-full sm:w-auto">
                Poznaj możliwości
              </BrandButton>
            }
          >
            <ul className="mt-1 space-y-3 text-[15px] leading-relaxed text-exm-muted">
              <li>
                <span className="block text-exm-text">Rozmowa na progu</span>
                90 minut · {cena(talk, ROZMOWA_NA_PROGU.priceText)}
              </li>
              <li>
                <span className="block text-exm-text">POWRÓT</span>
                {POWROT.sessions} sesji · {cena(powrot, POWROT.priceText)}
              </li>
            </ul>
          </BrandCard>
        </div>
      </Container>
    </Section>
  );
}