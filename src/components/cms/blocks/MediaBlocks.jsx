import React from "react";
import { Image } from "@/components/ui/image";

const RATIO = { "16:9": "aspect-video", "4:3": "aspect-[4/3]", "1:1": "aspect-square", "9:16": "aspect-[9/16] max-w-sm mx-auto" };
const COLS = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "grid-cols-2 lg:grid-cols-4" };

function embed(url = "") {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/^https:\/\/.+\.(mp4|webm)(\?|$)/i.test(url)) return { file: url };
  return null;
}

export function GalleryBlock({ d, label }) {
  const zd = (d.zdjecia || []).filter((z) => z.obraz?.url);
  return (
    <div>
      {label && <p className="technical text-[10px] gold-text mb-4">{label}</p>}
      {d.tytul && <h2 className="relic-heading text-3xl md:text-4xl mb-8 whitespace-pre-line">{d.tytul}</h2>}
      <div className={`grid gap-3 md:gap-4 ${COLS[d.kolumny] || COLS["3"]}`}>
        {zd.map((z, i) => (
          <figure key={i}>
            <Image src={z.obraz.url} alt={z.obraz.alt || ""} focalPointX={(z.obraz.fx ?? 50) / 100} focalPointY={(z.obraz.fy ?? 50) / 100} className="w-full aspect-[4/5]" />
            {z.podpis && <figcaption className="technical text-[9px] text-foreground/50 mt-2">{z.podpis}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function VideoBlock({ d, label }) {
  const e = embed(d.url);
  return (
    <figure>
      {label && <p className="technical text-[10px] gold-text mb-4">{label}</p>}
      <div className={`${RATIO[d.proporcja] || RATIO["16:9"]} w-full bg-black border hairline`}>
        {e?.src && <iframe src={e.src} title={d.podpis || "Wideo"} className="w-full h-full" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
        {e?.file && <video src={e.file} controls playsInline preload="metadata" className="w-full h-full object-contain" />}
        {!e && <p className="h-full flex items-center justify-center text-sm text-foreground/40">Wklej link YouTube, Vimeo lub pliku MP4.</p>}
      </div>
      {d.podpis && <figcaption className="technical text-[9px] text-foreground/50 mt-3">{d.podpis}</figcaption>}
    </figure>
  );
}