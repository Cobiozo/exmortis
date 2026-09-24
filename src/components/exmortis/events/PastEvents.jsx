import React from "react";
import EventTile from "./EventTile";

// Minione spotkania z nagraniami — te same kafelki, wersja przygaszona.
export default function PastEvents({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <section className="px-5 md:px-10 pt-4 pb-24 md:pb-32">
      <div className="max-w-[900px]">
        <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] mb-10">Minione spotkania</h2>
        <div className="space-y-4">
          {events.map((ev) => (
            <EventTile key={ev.id} event={ev} past />
          ))}
        </div>
      </div>
    </section>
  );
}