import React from "react";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import useCatalog from "@/lib/useCatalog";
import { unitPrice, zl, priceOnRequest } from "@/lib/productPrice";
import { POWROT, ROZMOWA_NA_PROGU } from "@/lib/powrotOffer";

// Współpraca indywidualna (etap 2, 18.11.2026): dwie osobne usługi, dwie osobne ceny z katalogu.
// Rozmowa na progu i POWRÓT to niezależne formy pracy — bez zbiorczego „od … zł”.
const SLUG_ROZMOWA = "rozmowa-na-progu";
const SLUG_POWROT = "powrot-mentoring";

const cena = (p, fallback) => (p && !priceOnRequest(p) && unitPrice(p) > 0 ? zl(unitPrice(p)) : fallback);

function Linia({ children }) {
  return <li className="flex gap-2.5 leading-relaxed"><span aria-hidden="true" className="mt-[0.55em] h-px w-3 shrink-0 bg-exm-gold" />{children}</li>;
}

export default function Collaboration({ d = {}, label }) {
  const { bySlug } = useCatalog();
  const rozmowa = bySlug(SLUG_ROZMOWA);
  const powrot = bySlug(SLUG_POWROT);

  return (
    {/* Kotwica #wspolpraca jest na opakowaniu bloku (uklad.kotwica) — bez zdublowanego id. */}
    <Section>
      <Container>
        <SectionHeader
          eyebrow={d.etykieta || label || "WSPÓŁPRACA INDYWIDUALNA"}
          title={d.tytul || "Dwie formy pracy jeden na jeden"}
          lead={d.tekst || "Krótka rozmowa o jednej ważnej sprawie albo dłuższa praca nad całym powrotem. Wybierz to, co jest teraz w Twoim zasięgu."}
        />

        <div className="mt-10 grid items-stretch gap-5 md:mt-14 md:grid-cols-2 md:gap-6">
          <BrandCard
            variant="usługa"
            label="ROZMOWA NA PROGU"
            title="Jedna ważna sprawa. 90 minut indywidualnej pracy."
            action={<BrandButton to="/rozmowa-na-progu/zgloszenie" className="w-full sm:w-auto">Umów Rozmowę na progu</BrandButton>}
          >
            <ul className="space-y-2 text-[15px] text-exm-muted">
              <Linia>Przygotowanie przed sesją</Linia>
              <Linia>90 minut online</Linia>
              <Linia>Podsumowanie na życzenie</Linia>
            </ul>
            <p className="mt-2 font-exm-serif text-2xl text-exm-gold">{cena(rozmowa, ROZMOWA_NA_PROGU.priceText)}</p>
            <p className="text-[14px] leading-relaxed text-exm-muted">Krótkie zgłoszenie → płatność → wybór terminu.</p>
            <p className="text-[13px] leading-relaxed text-exm-muted">Osobna usługa, niezależna od programu POWRÓT.</p>
          </BrandCard>

          <BrandCard
            variant="usługa"
            label="POWRÓT · MENTORING 1:1"
            title={`${POWROT.months} · ${POWROT.sessions} sesji po ${POWROT.lengthLong} · indywidualnie, online`}
            action={<BrandButton to="/powrot" className="w-full sm:w-auto">Poznaj program POWRÓT</BrandButton>}
          >
            <p className="mt-2 font-exm-serif text-2xl text-exm-gold">{cena(powrot, POWROT.priceText)}</p>
            <ul className="space-y-2 text-[15px] text-exm-muted">
              <Linia>{POWROT.installments}</Linia>
              <Linia>Najwyżej {POWROT.capacity} osoby jednocześnie.</Linia>
              <Linia>Zgłoszenie → ankieta → bezpłatna rozmowa wstępna na zaproszenie → decyzja.</Linia>
            </ul>
          </BrandCard>
        </div>
      </Container>
    </Section>
  );
}