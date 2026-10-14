import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { extractVideoId, thumbUrl } from "./youtube";
import GlosPlayer from "./GlosPlayer";

// Publiczna playlista utworów z encji „Utwor" (tylko widoczne, wg kolejności).
// Pusta lista → komponent nie renderuje nic.
export default function YouTubePlaylist() {
  const [songs, setSongs] = useState(null);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    base44.entities.Utwor
      .filter({ widoczny: true }, { sort: "kolejnosc", limit: 100 })
      .then((r) => setSongs(r.items || []))
      .catch(() => setSongs([]));
  }, []);

  // Po zmianie aktywnego utworu przewiń listę tak, by pozycja była widoczna.
  useEffect(() => {
    const c = listRef.current;
    if (!c || !songs || songs.length === 0) return;
    const el = c.querySelector('[data-active="true"]');
    if (!el) return;
    const top = el.offsetTop;
    if (top < c.scrollTop || top + el.offsetHeight > c.scrollTop + c.clientHeight) {
      c.scrollTop = top - c.clientHeight / 2 + el.offsetHeight / 2;
    }
  }, [idx, songs]);

  if (!songs || songs.length === 0) return null;

  const current = songs[Math.min(idx, songs.length - 1)];
  const currentId = extractVideoId(current.youtube_url) || "";

  const play = (i) => {
    setIdx(i);
    setStarted(true);
    document.getElementById("glos-player")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="mb-20 w-full">
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[3fr_2fr] gap-6 items-stretch">
        {/* Lewa kolumna: odtwarzacz + tytuł i licznik pod nim */}
        <div id="glos-player" className="min-w-0">
          <GlosPlayer
            videoId={currentId}
            started={started}
            onStart={() => setStarted(true)}
            onEnded={() => setIdx((i) => (i + 1 < songs.length ? i + 1 : 0))}
          />
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="relic-heading text-lg md:text-xl gold-text">{current.tytul}</p>
            <p className="technical text-[9px] text-foreground/55 shrink-0">
              {idx + 1} / {songs.length}
            </p>
          </div>
          {current.opis && (
            <p className="mt-1 text-foreground/55 leading-relaxed">{current.opis}</p>
          )}
        </div>

        {/* Prawa kolumna: playlista (na >=900 px wypełnia wysokość kolumny,
            wewnętrzny przewijany obszar) */}
        <div className="relative min-w-0 min-[900px]:min-h-0">
          <div
            ref={listRef}
            className="relative max-h-[368px] min-[900px]:max-h-none min-[900px]:absolute min-[900px]:inset-0 overflow-y-auto [scrollbar-width:thin] border hairline divide-y divide-[#3D3D3F]/40"
          >
            {songs.map((s, i) => {
              const id = extractVideoId(s.youtube_url);
              const active = i === idx;
              return (
                <button
                  key={s.id}
                  data-active={active || undefined}
                  onClick={() => play(i)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors duration-300 ${
                    active
                      ? "bg-[#C9A24A]/10 border-l-2 border-[#C9A24A]"
                      : "border-l-2 border-transparent hover:bg-[#0F0F10]"
                  }`}
                >
                  {id && (
                    <img
                      src={thumbUrl(id)}
                      alt=""
                      className="w-24 h-[3.375rem] object-cover shrink-0 border hairline"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block relic-heading text-sm truncate ${
                        active ? "gold-text" : "text-foreground/85"
                      }`}
                    >
                      {s.tytul}
                    </span>
                    {s.opis && (
                      <span className="block text-foreground/55 text-xs mt-0.5 line-clamp-2">
                        {s.opis}
                      </span>
                    )}
                  </span>
                  <span className="technical text-[9px] text-foreground/55 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}