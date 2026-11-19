import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { listPublicEvents } from "@/lib/publicEvents";
import EventTile from "./EventTile";
import FeaturedEvent from "./FeaturedEvent";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import { track } from "@/lib/track";

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

        {/* Bezpłatny start (19.11.2026): karta z dawnego bloku „Wybierz swój pierwszy krok” — dla osób, które nie czekają na spotkanie. */}
        <div className="mt-5 flex flex-col gap-5 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg p-6 md:mt-6 md:flex-row md:items-center md:justify-between md:gap-8 md:p-8">
          <div className="min-w-0">
            <p className="exm-eyebrow mb-2">BEZPŁATNIE</p>
            <h3 className="exm-h3">Zacznij bezpłatnie</h3>
            <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-exm-muted">Test autorefleksji, bezpłatne materiały i podcast — możesz zacząć od razu, bez czekania na spotkanie.</p>
          </div>
          <BrandButton to="/zacznij?src=home-spotkania" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={() => track("home_bezplatne_click")}>
            Zobacz bezpłatne materiały
          </BrandButton>
        </div>
      </Container>
    </Section>
  );
}