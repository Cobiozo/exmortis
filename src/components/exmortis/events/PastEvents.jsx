import React from "react";

import { whenText } from "./time";

// Minione spotkania — tylko te, które mają nagranie.
export default function PastEvents({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <section className="px-5 md:px-10 pb-24 md:pb-32">
      <div className="mx-auto max-w-[900px]">
        <p className="technical text-[11px] text-foreground/40 mb-10">MINIONE SPOTKANIA</p>
        <ul className="divide-y hairline border-y hairline">
          {events.map((ev) => (
            <li key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
              <div>
                <p className="shop-heading text-lg text-[#F5EFE1]">{ev.title}</p>
                <p className="text-xs text-foreground/40 mt-1">{whenText(ev.start_datetime)}</p>
              </div>
              <a
                href={ev.recording_url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost !px-5 !py-2.5 flex-shrink-0"
              >
                OBEJRZYJ NAGRANIE
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}