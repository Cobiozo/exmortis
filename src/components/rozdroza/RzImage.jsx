import React, { useState } from "react";
import { mediaSrcSet } from "@/lib/imgSrcSet";

const W = [480, 960, 1600];
// Adres obrazu w danej szerokości: biblioteka mediów (/functions/media) i media.base44.com mają wersje WebP.
export function imgSources(url) {
  if (!url) return null;
  if (url.startsWith("/functions/media")) return { src: `${url}&w=960`, srcSet: W.map((w) => `${url}&w=${w} ${w}w`).join(", ") };
  const m = mediaSrcSet(url);
  return m ? { src: m.src, srcSet: m.srcSet } : { src: url, srcSet: undefined };
}

// Wstępne pobranie (gdy przeglądarka ma wolne zasoby) — najwyżej kilka kolejnych kadrów.
export function prefetchImages(urls) {
  const run = () => urls.filter(Boolean).slice(0, 2).forEach((u) => {
    const s = imgSources(u); if (!s) return;
    const im = new Image(); im.decoding = "async"; if (s.srcSet) { im.sizes = "(min-width: 760px) 720px, 100vw"; im.srcset = s.srcSet; } im.src = s.src;
  });
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 800);
}

// Kadr z zarezerwowanym miejscem (bez przesunięć układu). Brak lub błąd obrazu → gradient EXMORTIS.
export default function RzImage({ url, alt = "", ratio = "aspect-video", eager = false, sizes = "(min-width: 760px) 720px, 100vw", className = "", shade = true }) {
  const [bad, setBad] = useState(false);
  const s = !bad ? imgSources(url) : null;
  return (
    <div className={`relative overflow-hidden ${ratio} ${className}`} style={{ background: "radial-gradient(120% 90% at 50% 20%, #2a1f12 0%, #14100c 45%, #0A0A0B 100%)" }}>
      {s && (
        <img src={s.src} srcSet={s.srcSet} sizes={s.srcSet ? sizes : undefined} alt={alt} loading={eager ? "eager" : "lazy"}
          fetchpriority={eager ? "high" : undefined} decoding="async" draggable={false} onError={() => setBad(true)}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
      {shade && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A0A0B]/80 pointer-events-none" aria-hidden="true" />}
    </div>
  );
}
