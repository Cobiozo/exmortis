import React from "react";
import { Link } from "react-router-dom";

// Zwarty wiersz biblioteki: numer, tytuł, data/czas, 1–2 zdania opisu i jedno działanie.
// Na telefonie działanie schodzi pod tekst, żeby tytuł nie został ściśnięty.
export default function GlosRow({ number, title, meta, desc, cover, href, action }) {
  return (
    <li className="border-b border-exm-line last:border-b-0">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
        {cover}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {number && <span className="technical shrink-0 text-[11px] text-exm-gold">{number}</span>}
            <h4 className="min-w-0 font-exm-serif text-[19px] leading-snug text-exm-ivory">
              {href ? (
                <Link to={href} className="transition-colors hover:text-exm-gold-hover">{title}</Link>
              ) : (
                title
              )}
            </h4>
          </div>
          {meta && <p className="mt-1 text-[13px] leading-relaxed text-exm-muted">{meta}</p>}
          {desc && <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-exm-muted">{desc}</p>}
        </div>
        {action && <div className="shrink-0 sm:pt-0.5">{action}</div>}
      </div>
    </li>
  );
}