import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { coverOf, CoverTile } from "./cover";
import { dateParts, timeText, whenText, durationText, formatText, warsawNote } from "./time";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";

// Najbliższe spotkanie jako szeroka karta pozioma (etap 2, 18.11.2026): obraz 16:9 obok treści.
// Bez okładki zostaje zastępcza grafika marki. Zapis prowadzi na stronę spotkania (ten sam formularz).
const CTA = "btn-relic w-full sm:w-auto";

function Cta({ ev }) {
  if (ev.status === "Odwołane") {
    return <p className="technical text-[11px] text-exm-muted">Spotkanie odwołane</p>;
  }
  const external = ev.registration_type === "Link zewnętrzny" && ev.external_url;
  if (external) {
    return <a href={ev.external_url} target="_blank" rel="noreferrer" className={CTA}>Dołącz do transmisji <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>;
  }
  return <Link to={`/spotkania/${ev.slug}#zapis`} className={CTA}>Zapisz się <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
}

export default function FeaturedEvent({ ev }) {
  const free = !(Number(ev.price) > 0);
  const tbd = !ev.start_datetime;
  const d = tbd ? null : dateParts(ev.start_datetime);
  const cover = coverOf(ev);
  const note = tbd ? null : warsawNote(ev.start_datetime);

  return (
    <article className="overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface md:flex">
      <div className="relative shrink-0 md:w-[46%]">
        {cover
          ? <CoverTile ev={ev} className="aspect-[16/9] h-full w-full" />
          : <ImageFallback label={ev.title || "Spotkanie exmortis"} className="aspect-[16/9] h-full w-full" />}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 md:p-7">
        <p className="exm-eyebrow">Najbliższe spotkanie</p>
        <h3 className="exm-h3 text-balance">{ev.title}</h3>
        {ev.subtitle && <p className="text-[15px] leading-relaxed text-exm-muted">{ev.subtitle}</p>}

        <dl className="mt-1 space-y-1.5 text-[14px] leading-relaxed text-exm-muted">
          <div className="flex flex-wrap gap-x-2">
            <dt className="sr-only">Termin</dt>
            <dd>{tbd ? "Termin do ustalenia" : whenText(ev.start_datetime)}</dd>
            {d && <dd className="text-exm-muted/80">({d.weekday})</dd>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {!tbd && <dd>{timeText(ev.start_datetime)}</dd>}
            <dd>{durationText(ev.duration_minutes)}</dd>
            <dd>{formatText(ev.format)}</dd>
            <dd className={free ? "text-exm-gold" : "text-exm-text"}>{free ? "Bezpłatne" : `${Number(ev.price)} zł`}</dd>
          </div>
          {note && <dd>{note}</dd>}
        </dl>

        <div className="mt-auto pt-2"><Cta ev={ev} /></div>
      </div>
    </article>
  );
}