import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CoverTile } from "./cover";
import { dateParts, timeText, priceText } from "./time";

// Karta płatnego wydarzenia w sekcjach Skarbca (Praktyka, Krąg) — z datą,
// prowadząca do strony wydarzenia.
export default function ShopEventCard({ event: ev }) {
  const { day, month, weekday } = dateParts(ev.start_datetime);
  return (
    <Link
      to={`/spotkania/${ev.slug}?src=sklep`}
      className="group flex flex-col border hairline bg-[#0D0D0E] p-7 transition-all duration-500 hover:border-[#C9A24A]/40 snap-start shrink-0 w-[82%] sm:w-auto"
    >
      <CoverTile ev={ev} className="aspect-[3/2] -mx-7 -mt-7 mb-6" />
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="shop-heading text-4xl gold-text leading-none">
            {day} <span className="text-base text-foreground/50">{month}</span>
          </p>
          <p className="technical text-[9px] text-foreground/40 mt-2">
            {weekday} · {timeText(ev.start_datetime).toUpperCase()}
          </p>
        </div>
        <span className="technical text-[9px] text-[#C9A24A] border border-[#C9A24A]/40 px-2 py-1">
          {ev.event_type.toUpperCase()}
        </span>
      </div>

      <h3 className="shop-heading text-xl text-[#F5EFE1] leading-snug [text-wrap:balance] break-words">{ev.title}</h3>
      {ev.subtitle && (
        <p className="italic text-foreground/70 text-sm mt-2 leading-relaxed">{ev.subtitle}</p>
      )}
      {(ev.format || ev.location) && (
        <p className="technical text-[9px] text-foreground/35 mt-3">
          {[ev.format, ev.format === "Stacjonarnie" ? ev.location : null]
            .filter(Boolean)
            .join(" · ")
            .toUpperCase()}
        </p>
      )}

      <div className="mt-auto pt-5 border-t hairline space-y-3">
        <p className="text-base text-[#F5EFE1]">{priceText(ev.price)}</p>
        <span className="btn-ghost !px-4 !py-2.5 w-full">
          SPOTKANIE · ZOBACZ DATĘ <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}