import React from "react";
import Section from "./Section";

const ITEMS = [
  "Chcesz szybkiej motywacji na weekend.",
  "Szukasz kogoś, kto powie Ci, co masz zrobić.",
  "Chcesz „poczuć się lepiej”, ale nie chcesz nic zmieniać.",
  "Jesteś w głębokim kryzysie klinicznym — wtedy potrzebujesz terapeuty, nie mentora. Powiem Ci to na rozmowie i jeśli trzeba, wskażę kierunek.",
];

export default function NotForYou() {
  return (
    <Section dark label="NIE DLA CIEBIE · 03">
      <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
        To <span className="blood-text">NIE</span> jest dla Ciebie, jeśli:
      </h2>
      <ul className="max-w-3xl space-y-5 border-l hairline pl-8">
        {ITEMS.map((p, i) => (
          <li key={i} className="flex items-baseline gap-4 text-lg text-foreground/70">
            <span className="blood-text font-mono flex-shrink-0">—</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}