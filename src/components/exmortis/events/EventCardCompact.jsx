import React from "react";
import { Link } from "react-router-dom";
import { dateParts, timeText, durationText, priceText } from "./time";

// Kompaktowa karta wydarzenia (strona główna) — ten sam wygląd co na /spotkania.
export default function EventCardCompact({ event: ev }) {
  const { day, month, weekday } = dateParts(ev.start_datetime);
  return (
    <Link
      to={`/spotkania/${ev.slug}?src=home`}
      className="group flex flex-col border hairline bg-[#0D0D0E] p-6 md:p-8 transition-all duration-500 hover:border-[#C9A24A]/40"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="shop-heading text-4xl gold-text leading-none">
            {day} <span className="text-lg text-foreground/50">{month}</span>
          </p>
          <p className="technical text-[9px] text-foreground/40 mt-2">{weekday}</p>
        </div>
        <span className="technical text-[9px] text-[#C9A24A] border border-[#C9A24A]/40 px-2 py-1">
          {ev.event_type.toUpperCase()}
        </span>
      </div>
      <h3 className="shop-heading text-xl text-[#F5EFE1] leading-snug">{ev.title}</h3>
      {ev.subtitle && (
        <p className="italic text-foreground/60 text-sm mt-3 leading-relaxed">{ev.subtitle}</p>
      )}
      <p className="technical text-[9px] text-foreground/40 mt-5">
        {[`${timeText(ev.start_datetime)} · ${durationText(ev.duration_minutes)}`, ev.format]
          .filter(Boolean)
          .join(" · ")
          .toUpperCase()}
      </p>
      <p className="mt-auto pt-6 text-[#F5EFE1]">{priceText(ev.price)}</p>
    </Link>
  );
}