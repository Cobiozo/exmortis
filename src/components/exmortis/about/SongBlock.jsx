import React, { useState } from "react";
import { ArrowRight, Play } from "lucide-react";

// Wklej tutaj ID filmu z YouTube (fragment adresu po „watch?v=”),
// np. dla https://www.youtube.com/watch?v=abc12345 — „abc12345”.
const VIDEO_ID = "";
const WATCH_URL = VIDEO_ID
  ? `https://www.youtube.com/watch?v=${VIDEO_ID}`
  : "https://www.youtube.com/@e.x.m.o.r.t.i.s";

// Podstrona O mnie: blok z piosenką. Wideo ładuje się dopiero po kliknięciu
// (najpierw miniatura ze złotym przyciskiem play, potem iframe youtube-nocookie).
export default function SongBlock() {
  const [play, setPlay] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);

  return (
    <section className="py-24 md:py-32 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">POSŁUCHAJ · EXMORTIS</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-12 leading-[0.95]">
          Całą tę historię opowiedziałem w piosence.
        </h2>

        <div className="w-full">
          {play ? (
            <div className="relative w-full aspect-video border border-[#C9A24A]/60">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1`}
                title="exmortis — piosenka"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              onClick={() => setPlay(true)}
              aria-label="Odtwórz piosenkę"
              className="relative block w-full aspect-video border border-[#C9A24A]/60 bg-[#070708] overflow-hidden group"
            >
              {VIDEO_ID && thumbOk && (
                <img
                  src={`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                  alt="exmortis — miniatura piosenki"
                  onError={() => setThumbOk(false)}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-[#C9A24A] bg-[#0A0A0B]/70 flex items-center justify-center group-hover:bg-[#C9A24A]/20 transition-colors">
                  <Play className="h-7 w-7 gold-text translate-x-0.5" fill="currentColor" />
                </span>
              </span>
            </button>
          )}

          <a
            href={WATCH_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:gold-text transition-colors mt-4"
          >
            Otwórz na YouTube <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}