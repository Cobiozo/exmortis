import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import EventTile from "./EventTile";

// Strona główna: „Najbliższe spotkania" — do 3 opublikowanych wydarzeń.
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
        <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-14">
          Najbliższe<br />spotkania
        </h2>

        <div className="max-w-[900px] space-y-4">
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