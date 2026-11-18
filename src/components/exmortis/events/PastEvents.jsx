import React, { useState } from "react";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import EventCard from "./EventCard";

// Minione spotkania: zwinięte pod przyciskiem, żeby nie przesłaniały najbliższych terminów.
// Nagrania są w kontach osób zapisanych na dane spotkanie — karta prowadzi do konta.
export default function PastEvents({ events }) {
  const [open, setOpen] = useState(false);
  if (!events || events.length === 0) return null;

  return (
    <Section aria-labelledby="minione-spotkania">
      <Container>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
          <SectionHeader
            eyebrow="Archiwum"
            title="Minione spotkania"
            id="minione-spotkania"
            lead="Nagrania są dostępne w kontach osób zapisanych na dane spotkanie."
          />
          <div className="shrink-0">
            <BrandButton
              variant="secondary"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="minione-lista"
            >
              {open ? "Ukryj minione spotkania" : "Pokaż minione spotkania"}
            </BrandButton>
          </div>
        </div>

        {open && (
          <div id="minione-lista" className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => <EventCard key={ev.id} ev={ev} archive />)}
          </div>
        )}
      </Container>
    </Section>
  );
}