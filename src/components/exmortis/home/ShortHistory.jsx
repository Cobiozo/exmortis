import React from "react";
import { Image } from "@/components/ui/image";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// „Za exmortis stoi człowiek” (etap 2, 18.11.2026): portret 4:5 obok krótkiej historii.
// Zdjęcie i kadrowanie z panelu (pole „zdjecie”); bez zdjęcia zostaje sam tekst.
const PORTRET = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/480c7c335_702144182_17895011880460401_728690723499574380_n.jpg";

export default function ShortHistory({ d = {}, label }) {
  const foto = d.zdjecie?.url ? d.zdjecie : { url: PORTRET, alt: "Dawid — exmortis" };

  return (
    <Section id="historia" tone="surface">
      <Container>
        <div className="grid items-start gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-7">
            <SectionHeader
              eyebrow={d.etykieta || label || "ZA EXMORTIS STOI CZŁOWIEK"}
              title={<span>Byłem tam. <span className="text-exm-gold">I wróciłem inny.</span></span>}
            />

            <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-exm-muted md:mt-8">
              <p>Przez lata towarzyszyłem ludziom w ich najtrudniejszych chwilach.</p>
              <p>Potem sam znalazłem się w miejscu, którego nie było na mojej mapie. Straciłem wiele z tego, na czym opierałem swoje życie.</p>
            </div>

            <blockquote className="my-7 border-l border-exm-gold/60 pl-5 md:my-9 md:pl-7">
              <p className="font-exm-serif text-xl leading-snug text-exm-gold md:text-2xl">
                „Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”
              </p>
            </blockquote>

            <div className="space-y-4 text-[17px] leading-relaxed text-exm-muted">
              <p>Dziś jestem mężem i ojcem. O tym, co wydarzyło się pomiędzy, opowiadam w pełnej historii.</p>
              <p className="text-exm-text">
                Prowadzę mentoring powrotu, nie terapię: nie stawiam diagnoz i nie zastępuję leczenia.
              </p>
            </div>

            <div className="mt-7 md:mt-9">
              <BrandButton to="/o-mnie?src=home-historia" variant="secondary">Poznaj moją historię</BrandButton>
            </div>
          </div>

          <div className="md:col-span-5">
            <figure className="overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2">
              <Image
                src={foto.url}
                alt={foto.alt || "Dawid — exmortis"}
                fittingType="fill"
                focalPointX={Number(foto.fx ?? 50) / 100}
                focalPointY={Number(foto.fy ?? 50) / 100}
                className="aspect-[4/5] w-full"
              />
              <figcaption className="technical border-t border-exm-line px-4 py-3 text-[10px] text-exm-muted">
                DZIŚ · MĄŻ, OJCIEC, MENTOR
              </figcaption>
            </figure>
          </div>
        </div>
      </Container>
    </Section>
  );
}