import React from "react";
import { plWhenFull } from "./time";
import WarsawNote from "./WarsawNote";

// Treść nagłówka strony spotkania (na okładce): typ, tytuł, data, główny przycisk.
export function heroAction(ev) {
  if (ev.status === "Odwołane") return null;
  if (ev.registration_type === "Link zewnętrzny" && ev.external_url) return { label: "Dołącz do transmisji", href: ev.external_url, ext: true };
  if (ev.registration_type === "Zapis na stronie") return { label: "Zapisz się", href: "#zapis" };
  return null;
}

export default function HeroContent({ ev, small }) {
  const a = heroAction(ev);
  return (
    <div className="max-w-[900px] min-w-0">
      <p className="technical text-[10px] gold-text mb-3">{String(ev.event_type || "").toUpperCase()}</p>
      <h1 className="shop-heading text-[#F5EFE1] leading-[1.05] break-words [text-wrap:balance]"
        style={{ fontSize: small ? "clamp(1.4rem, 5vw, 2.2rem)" : "clamp(2rem, 6vw, 4.5rem)" }}>
        {ev.title || "Tytuł spotkania"}
      </h1>
      {ev.start_datetime && <p className="mt-4 gold-text shop-heading text-lg md:text-xl">{plWhenFull(ev.start_datetime, " · ")}<WarsawNote iso={ev.start_datetime} /></p>}
      {a && (
        <a href={a.href} target={a.ext ? "_blank" : undefined} rel={a.ext ? "noreferrer" : undefined}
          className="btn-relic mt-6 w-full sm:w-auto">{a.label.toUpperCase()}</a>
      )}
    </div>
  );
}