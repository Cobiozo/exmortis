import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { plWhen } from "@/components/exmortis/events/time";

// POWRÓT: jedna linia nad przyciskiem kwalifikacyjnym — pokazywana tylko,
// gdy istnieje nadchodzące bezpłatne „Spotkanie otwarte".
export default function EventLine() {
  const [event, setEvent] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("eventsPublic", { action: "list" })
      .then((res) => {
        const ev = (res.data.upcoming || []).find(
          (e) => e.status === "Opublikowane" && e.event_type === "Spotkanie otwarte" && Number(e.price) === 0
        );
        setEvent(ev || false);
      })
      .catch(() => setEvent(false));
  }, []);

  if (!event) return null;

  return (
    <p className="text-foreground/60 leading-relaxed">
      Chcesz najpierw zobaczyć, jak pracuję? Przyjdź na najbliższy{" "}
      <Link to={`/spotkania/${event.slug}?src=powrot`} className="gold-text hover:underline">
        Wieczór powrotu
      </Link>{" "}
      — {plWhen(event.start_datetime)}, bezpłatnie.
    </p>
  );
}