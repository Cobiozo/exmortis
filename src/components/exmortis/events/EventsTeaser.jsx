import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { listPublicEvents } from "@/lib/publicEvents";
import EventTile from "./EventTile";
import FeaturedEvent from "./FeaturedEvent";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// „Spotkajmy się” (etap 2, 18.11.2026): najbliższe spotkanie jako szeroka karta, kolejne jako kafle.
// Bez spotkań zostaje zwarta informacja i odnośnik do Listów powrotu — sekcja nigdy nie jest pustym blokiem.
export default function EventsTeaser({ d = {}, label }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    // Wspólne pobranie z nagłówkiem strony głównej (jedno zapytanie zamiast dwóch).
    listPublicEvents()
      .then((data) => setEvents((data.upcoming || []).filter((e) => e.status === "Opublikowane").slice(0, 3)))
      .catch(() => setEvents([]));
  }, []);

  const [next, ...rest] = events || [];

  return (
    <Section tone="surface">
      <Container>
        <SectionHeader
          eyebrow={d.etykieta || label || "SPOTKAJMY SIĘ"}
          title={d.tytul || "Spotkajmy się"}
          lead="Otwarte spotkania online i na żywo. Możesz przyjść bez zapowiedzi i bez zobowiązań — wystarczy zapis."
          action={<BrandButton to="/spotkania?src=home" variant="secondary">Wszystkie spotkania</BrandButton>}
        />

        <div className="mt-10 md:mt-14">
          {events === null && <div className="h-[280px] animate-pulse rounded-[var(--exm-r-card)] bg-exm-bg/60" />}

          {next && <FeaturedEvent ev={next} />}

          {next && rest.length > 0 && (
            <div className="mt-5 grid items-stretch gap-5 md:mt-6 md:grid-cols-2">
              {rest.map((ev) => <EventTile key={ev.id} event={ev} compact />)}
            </div>
          )}

          {events !== null && !next && (
            <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg p-6 md:p-8">
              <p className="text-[16px] leading-relaxed text-exm-muted">
                W tej chwili nie ma zaplanowanych otwartych spotkań. Kolejne ogłaszam najpierw w Listach powrotu.
              </p>
              <a href="#listy-powrotu" className="btn-link mt-3">Przejdź do Listów powrotu <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
          )}
        </div>

        <p className="mt-8 md:mt-10">
          <Link to="/glos" className="btn-link">Posłuchaj, jak mówię o powrocie <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </p>
      </Container>
    </Section>
  );
}