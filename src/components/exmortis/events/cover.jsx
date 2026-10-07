import React from "react";

// Okładka spotkania: odczyt danych + obraz kafelka (3:2, leniwie) i nagłówka (4:5 / 16:9, z wyprzedzeniem).
export function coverOf(ev) {
  let c = ev?.cover;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
  if (c?.src) return { dim: 45, ...c, crops: c.crops || {} };
  if (ev?.cover_image) return { src: ev.cover_image, alt: ev.title, dim: 45, fx: 0.5, fy: 0.5, crops: {} };
  return null;
}

const Cancelled = () => (
  <span className="absolute top-3 left-3 technical text-[9px] bg-[#0A0A0B]/85 text-[#E2E2E2] border border-[#E2E2E2]/40 px-2 py-1">ODWOŁANE</span>
);

export function CoverTile({ ev, className = "aspect-[3/2]" }) {
  const c = coverOf(ev);
  if (!c) return null;
  const cancelled = ev.status === "Odwołane";
  return (
    <div className={`relative overflow-hidden bg-[#121212] ${className}`}>
      <img src={c.crops.tile || c.src} alt={c.alt || ev.title} loading="lazy" decoding="async" width="900" height="600"
        className={`absolute inset-0 w-full h-full object-cover ${cancelled ? "grayscale" : ""}`}
        style={{ objectPosition: `${(c.fx ?? 0.5) * 100}% ${(c.fy ?? 0.5) * 100}%` }} />
      {cancelled && <Cancelled />}
    </div>
  );
}

// Nagłówek strony spotkania z okładką i tekstem na przyciemnieniu.
export function CoverHero({ ev, forceTall, children }) {
  const c = coverOf(ev);
  const cancelled = ev.status === "Odwołane";
  const pos = `${(c?.fx ?? 0.5) * 100}% ${(c?.fy ?? 0.5) * 100}%`;
  const ratio = forceTall === true ? "aspect-[4/5]" : forceTall === false ? "aspect-video" : "aspect-[4/5] md:aspect-video md:max-h-[86vh] w-full";
  return (
    <div className={`relative overflow-hidden bg-[#0A0A0B] ${ratio}`}>
      {c && (
        <picture>
          {forceTall === undefined && c.crops.wide && <source media="(min-width: 768px)" srcSet={c.crops.wide} />}
          <img src={(forceTall === false ? c.crops.wide : c.crops.tall) || c.src} alt={c.alt || ev.title} fetchpriority="high" decoding="async"
            className={`absolute inset-0 w-full h-full object-cover ${cancelled ? "grayscale" : ""}`} style={{ objectPosition: pos }} />
        </picture>
      )}
      <div className="absolute inset-0 bg-black" style={{ opacity: (c ? c.dim ?? 45 : 0) / 100 }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A0A0B] to-transparent" />
      {cancelled && <Cancelled />}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 md:p-12">{children}</div>
    </div>
  );
}