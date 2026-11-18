import React from "react";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandCard from "@/components/exmortis/ui/BrandCard";

// „Jak dołączyć": trzy kroki w poziomie (telefon: pionowo). Sam opis drogi — bez dat i bez obietnic.
const STEPS = [
  {
    title: "Zapis",
    text: "Wybierz spotkanie i zostaw imię oraz adres e-mail. Zajmuje to chwilę.",
  },
  {
    title: "Potwierdzenie z linkiem",
    text: "Link do spotkania otrzymasz w wiadomości e-mail. Jest przypisany do Ciebie, więc zachowaj go.",
  },
  {
    title: "Spotkanie",
    text: "W dniu spotkania otwórz link kilka minut przed startem. Przy spotkaniu stacjonarnym adres otrzymasz po zapisaniu.",
  },
];

export default function HowToJoin() {
  return (
    <Section tone="surface" aria-labelledby="jak-dolaczyc">
      <Container>
        <SectionHeader eyebrow="Zapis" title="Jak dołączyć" id="jak-dolaczyc" lead="Od zapisu do spotkania — trzy kroki." />
        <ol className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="min-w-0">
              <BrandCard variant="krok" step={String(i + 1).padStart(2, "0")} title={s.title} description={s.text} />
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}