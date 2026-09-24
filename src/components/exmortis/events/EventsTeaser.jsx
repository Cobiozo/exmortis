import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import EventCardCompact from "./EventCardCompact";

// Strona główna: „Najbliższe spotkania" — do 3 nadchodzących wydarzeń.
// Cała sekcja znika, gdy nie ma żadnego opublikowanego wydarzenia.
export default function EventsTeaser() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("eventsPublic", { action: "list" })
      .then((res) =>
        setEvents(
          (res.data.upcoming || []).filter((e) => e.status === "Opublikowane").slice(0, 3)
        )
      )
      .catch(() => setEvents([]));
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <section className="relative py-32 px-5 md:px-10 border-t hairline">
      <div className="absolute right-0 top-0 bottom-0 w-px spine opacity-30" />
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">SPOTKANIA</p>
        <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-16">
          Najbliższe<br />spotkania
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => (
            <EventCardCompact key={ev.id} event={ev} />
          ))}
        </div>

        <Link to="/spotkania?src=home" className="btn-ghost mt-12">
          Wszystkie spotkania <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}