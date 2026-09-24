import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { dateParts, timeText, durationText, priceText } from "./time";

// Karta wydarzenia na liście: duży blok daty po lewej, treść po prawej.
export default function EventCard({ event: ev }) {
  const { day, month, weekday } = dateParts(ev.start_datetime);
  const cancelled = ev.status === "Odwołane";
  const capacity = ev.capacity ? Number(ev.capacity) : 0;
  const spotsLeft = capacity > 0 ? capacity - (ev.registered || 0) : null;

  return (
    <article
      className={`border hairline bg-[#0D0D0E] transition-all duration-500 hover:border-[#C9A24A]/40 ${
        cancelled ? "opacity-50" : ""
      }`}
    >
      <Link to={`/spotkania/${ev.slug}`} className="flex flex-col md:flex-row gap-6 md:gap-10 p-6 md:p-8">
        <div className="flex md:flex-col items-center md:items-start gap-5 md:gap-1 md:w-28 flex-shrink-0">
          <span className="shop-heading text-5xl md:text-6xl gold-text leading-none">{day}</span>
          <span className="flex md:flex-col items-baseline gap-2 md:gap-0">
            <span className="text-sm text-foreground/60">{month}</span>
            <span className="technical text-[9px] text-foreground/40">{weekday}</span>
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="technical text-[9px] text-[#C9A24A] border border-[#C9A24A]/40 px-2 py-1">
              {ev.event_type.toUpperCase()}
            </span>
            {cancelled && (
              <span className="technical text-[9px] blood-text border border-[#BC1E22]/40 px-2 py-1">
                ODWOŁANE
              </span>
            )}
          </div>

          <h3 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug">{ev.title}</h3>
          {ev.subtitle && <p className="italic text-foreground/60">{ev.subtitle}</p>}

          <p className="technical text-[9px] text-foreground/40">
            {[
              `${timeText(ev.start_datetime)} · ${durationText(ev.duration_minutes)}`,
              ev.format,
              ev.format === "Stacjonarnie" ? ev.location : null,
            ]
              .filter(Boolean)
              .join(" · ")
              .toUpperCase()}
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
            <span className="text-[#F5EFE1]">{priceText(ev.price)}</span>
            {!cancelled && spotsLeft !== null && spotsLeft <= 0 && (
              <span className="text-xs text-foreground/50">Lista rezerwowa</span>
            )}
            {!cancelled && spotsLeft !== null && spotsLeft > 0 && spotsLeft < capacity * 0.3 && (
              <span className="text-xs blood-text">zostało {spotsLeft} miejsc</span>
            )}
          </div>

          {!cancelled && (
            <span className="btn-ghost !px-5 !py-3 mt-4 self-start">
              ZOBACZ I ZAPISZ SIĘ <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}