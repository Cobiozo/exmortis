import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { listPublicEvents } from "@/lib/publicEvents";
import EventTile from "./EventTile";

// Strona główna: „Najbliższe spotkania" — do 3 opublikowanych wydarzeń.
// Cała sekcja znika, gdy nie ma żadnego opublikowanego wydarzenia.
export default function EventsTeaser({ label } = {}) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    // Wspólne pobranie z nagłówkiem strony głównej (jedno zapytanie zamiast dwóch).
    listPublicEvents()
      .then((data) =>
        setEvents(
          (data.upcoming || []).filter((e) => e.status === "Opublikowane").slice(0, 3)
        )
      )
      .catch(() => setEvents([]));
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-5 md:px-10 border-t hairline">
      <div className="absolute right-0 top-0 bottom-0 w-px spine opacity-30" />
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">{label || "SPOTKANIA · 07"}</p>
        <h2 className="relic-heading text-[32px] md:text-[44px] leading-[1.1] mb-8">
          Najbliższe spotkania
        </h2>

        <div className="grid gap-5 min-[520px]:grid-cols-2 min-[1101px]:grid-cols-3 items-stretch">
          {events.map((ev) => (
            <EventTile key={ev.id} event={ev} compact />
          ))}
        </div>

        <Link to="/spotkania?src=home" className="btn-ghost mt-12">
          Wszystkie spotkania <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}