import React from "react";
import { dateParts, timeText, durationText, formatText, warsawNote } from "./time";
import { spotsText } from "./spots";

// Siatka faktów spotkania: termin, godzina ze strefą, czas trwania, forma, cena, miejsca.
// Wszystkie wartości pochodzą z danych spotkania; miejsca tylko przy ustawionym limicie.
const Label = ({ children }) => <dt className="technical text-[10px] text-exm-muted">{children}</dt>;
const Value = ({ children }) => <dd className="mt-2 text-[15px] leading-relaxed text-exm-ivory">{children}</dd>;

export default function EventFacts({ ev }) {
  const tbd = !ev.start_datetime;
  const d = tbd ? null : dateParts(ev.start_datetime);
  const note = tbd ? null : warsawNote(ev.start_datetime);
  const free = !(Number(ev.price) > 0);
  const spots = spotsText(ev);
  const where =
    ev.format === "Stacjonarnie"
      ? ev.location || "Adres otrzymasz po zapisaniu"
      : formatText(ev.format);

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-exm-line py-6 sm:grid-cols-3">
      <div>
        <Label>Termin</Label>
        <Value>{tbd ? "Termin do ustalenia" : `${d.weekday}, ${d.day} ${d.month}`}</Value>
      </div>
      <div>
        <Label>Godzina</Label>
        <Value>{tbd ? "Godzina do ustalenia" : `${timeText(ev.start_datetime)}${note ? "" : " czasu polskiego"}`}</Value>
        {note && <p className="mt-1 text-[12px] leading-relaxed text-exm-muted">{note}</p>}
      </div>
      <div>
        <Label>Czas trwania</Label>
        <Value>{durationText(ev.duration_minutes)}</Value>
      </div>
      <div>
        <Label>Forma</Label>
        <Value>{where}</Value>
      </div>
      <div>
        <Label>Cena</Label>
        <Value>{free ? "Bezpłatne" : `${Number(ev.price)} zł`}</Value>
      </div>
      {spots && (
        <div>
          <Label>Miejsca</Label>
          <Value>{spots}</Value>
        </div>
      )}
    </dl>
  );
}