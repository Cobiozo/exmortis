import React from "react";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import { CoverTile, coverOf } from "./cover";
import { whenText, durationText, formatText } from "./time";
import { spotsText } from "./spots";

// Karta spotkania na liście (BrandCard wariant wydarzenie, obraz 16:9, przycisk na dole).
// archive: minione spotkanie — przycisk prowadzi do nagrania w koncie osoby zapisanej.
export default function EventCard({ ev, archive = false }) {
  const cancelled = ev.status === "Odwołane";
  const tbd = !ev.start_datetime;
  const free = !(Number(ev.price) > 0);
  const spots = archive ? null : spotsText(ev);
  const cover = coverOf(ev);
  const label = [ev.event_type, formatText(ev.format)].filter(Boolean).join(" · ");

  const action = cancelled ? (
    <p className="technical text-[10px] text-exm-muted">Spotkanie odwołane</p>
  ) : archive ? (
    <BrandButton to="/konto?tab=spotkania" variant="secondary" className="w-full">
      Nagranie dla zapisanych
    </BrandButton>
  ) : (
    <BrandButton to={`/spotkania/${ev.slug}#zapis`} className="w-full">
      Zapisz się
    </BrandButton>
  );

  return (
    <BrandCard
      variant="wydarzenie"
      media={
        cover
          ? <CoverTile ev={ev} className="h-full w-full" />
          : <ImageFallback label={ev.title || "Spotkanie exmortis"} className="h-full w-full" />
      }
      label={label}
      title={ev.title}
      description={ev.subtitle}
      action={action}
      className={cancelled || archive ? "opacity-75" : ""}
    >
      <dl className="text-[14px] leading-relaxed text-exm-muted">
        <div>
          <dt className="sr-only">Termin</dt>
          <dd className="text-exm-text">{tbd ? "Termin do ustalenia" : whenText(ev.start_datetime)}</dd>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <dd>{durationText(ev.duration_minutes)}</dd>
          <dd className={free ? "text-exm-gold" : undefined}>{free ? "Bezpłatne" : `${Number(ev.price)} zł`}</dd>
          {spots && <dd className="text-exm-gold">{spots}</dd>}
        </div>
      </dl>
    </BrandCard>
  );
}