import React from "react";
import { Image } from "@/components/ui/image";
import { BrandButton, BrandCard } from "@/components/exmortis/ui";
import { productHref } from "@/components/exmortis/shop/cardBits";

// Jeden rekomendowany krok po wyniku (z obecnej logiki nextSteps — główny krok to Listy powrotu)
// oraz dwie–trzy bezpłatne możliwości jako mniejsze karty. Bez oferty zależnej od punktów.
const LISTY = "/#listy-powrotu";

export default function TestNextStep({ main, free = [] }) {
  const cover = main ? main.cover_image || main.image_url : null;

  return (
    <section className="mt-[var(--exm-section-y)]" aria-labelledby="test-nastepny">
      <h2 id="test-nastepny" className="exm-h2">Jeden następny krok</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-exm-muted">
        Nie musisz robić wszystkiego naraz. Wybierz jedno miejsce, od którego chcesz zacząć.
      </p>

      <div className="mt-6">
        {main ? (
          <BrandCard
            featured
            variant="usługa"
            label="Rekomendowany krok"
            title={main.name}
            description={main.promise || main.subtitle || ""}
            media={cover ? <Image src={cover} alt="" fittingType="fill" className="h-full w-full" /> : null}
            action={<BrandButton to={productHref(main)}>Zapisz się na Listy powrotu</BrandButton>}
          />
        ) : (
          <BrandCard
            featured
            variant="krok"
            label="Rekomendowany krok"
            title="Listy powrotu"
            description="Bezpłatne listy o powrocie z siebie. Zapiszesz się w kilka sekund, bez zobowiązań."
            action={<BrandButton to={LISTY}>Zapisz się na Listy powrotu</BrandButton>}
          />
        )}
      </div>

      {free.length > 0 && (
        <>
          <p className="exm-eyebrow mt-10">Bezpłatnie, bez zobowiązań</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {free.map((p) => (
              <BrandCard
                key={p.slug}
                variant="krok"
                title={p.name}
                description={p.promise || p.subtitle || ""}
                meta={[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase() || undefined}
                action={<BrandButton variant="secondary" to={productHref(p)}>Otwórz</BrandButton>}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}