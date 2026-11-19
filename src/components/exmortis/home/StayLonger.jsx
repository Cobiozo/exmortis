import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Headphones, Timer } from "lucide-react";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";

// „Zostań na dłużej” (etap 2, 18.11.2026): trzy lekkie kafle — podcast, Biblioteka, Chwila ciszy.
const KAFLE = [
  {
    to: "/glos",
    Icon: Headphones,
    tytul: "Podcast „Głos”",
    opis: "Rozmowy o powrocie i o tym, co pomaga wracać.",
    link: "Posłuchaj",
  },
  {
    to: "/konto?tab=biblioteka",
    Icon: BookOpen,
    tytul: "Biblioteka",
    opis: "Materiały i nagrania — dostępne po zalogowaniu.",
    link: "Otwórz Bibliotekę",
  },
  {
    to: "/cisza",
    Icon: Timer,
    tytul: "Chwila ciszy",
    opis: "Minutnik ciszy — tyle czasu, ile teraz potrzebujesz.",
    link: "Wejdź w ciszę",
  },
];

export default function StayLonger({ d = {}, label }) {
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow={d.etykieta || label || "ZOSTAŃ NA DŁUŻEJ"}
          title={d.tytul || "Między jednym krokiem a następnym"}
        />
        <div className="mt-8 grid gap-4 md:mt-12 md:grid-cols-3 md:gap-5">
          {KAFLE.map(({ to, Icon, tytul, opis, link }) => (
            <Link
              key={to}
              to={to}
              className="group flex h-full flex-col gap-3 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 transition-colors hover:border-exm-gold-line"
            >
              <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-[var(--exm-r-field)] border border-exm-line text-exm-gold">
                <Icon className="h-5 w-5" strokeWidth={1.4} />
              </span>
              <h3 className="exm-h3">{tytul}</h3>
              <p className="text-[15px] leading-relaxed text-exm-muted">{opis}</p>
              {/* Cały kafel jest linkiem; na dole wygląda jak przycisk marki (19.11.2026). */}
              <span className="btn-ghost mt-auto self-start group-hover:border-exm-gold">
                {link} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}