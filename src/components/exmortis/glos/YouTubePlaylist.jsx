import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { extractVideoId, thumbUrl } from "./youtube";
import GlosPlayer from "./GlosPlayer";
import { useAuth } from "@/lib/AuthContext";

// Publiczna playlista utworów z encji „Utwor" (tylko widoczne, wg kolejności).
// Pusta lista → komponent nie renderuje nic.
export default function YouTubePlaylist() {
  const [songs, setSongs] = useState(null);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    base44.entities.Utwor
      .filter({ widoczny: true }, { sort: "kolejnosc", limit: 100 })
      .then((r) => setSongs(r.items || []))
      .catch(() => setSongs([]));
  }, []);

  if (!songs || songs.length === 0) return null;

  const current = songs[Math.min(idx, songs.length - 1)];
  const currentId = extractVideoId(current.youtube_url) || "";

  const play = (i) => {
    setIdx(i);
    setStarted(true);
    document.getElementById("glos-player")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="mb-20">
      <div id="glos-player" className="max-w-4xl mx-auto">
        <GlosPlayer
          videoId={currentId}
          started={started}
          onStart={() => setStarted(true)}
          onEnded={() => setIdx((i) => (i + 1 < songs.length ? i + 1 : 0))}
        />
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <p className="relic-heading text-lg md:text-xl gold-text">{current.tytul}</p>
          <p className="technical text-[9px] text-foreground/40 shrink-0">
            {idx + 1} / {songs.length}
          </p>
        </div>
        {current.opis && (
          <p className="mt-1 text-foreground/55 leading-relaxed">{current.opis}</p>
        )}
      </div>

      <div className="mt-10 max-w-4xl mx-auto border hairline divide-y divide-[#3D3D3F]/40">
        {songs.map((s, i) => {
          const id = extractVideoId(s.youtube_url);
          const active = i === idx;
          return (
            <button
              key={s.id}
              onClick={() => play(i)}
              className={`w-full flex items-center gap-4 md:gap-6 p-4 md:p-5 text-left transition-colors duration-300 ${
                active
                  ? "bg-[#C9A24A]/10 border-l-2 border-[#C9A24A]"
                  : "border-l-2 border-transparent hover:bg-[#0F0F10]"
              }`}
            >
              {id && (
                <img
                  src={thumbUrl(id)}
                  alt=""
                  className="w-24 h-14 md:w-32 md:h-[4.5rem] object-cover shrink-0 border hairline"
                />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={`block relic-heading text-sm md:text-base truncate ${
                    active ? "gold-text" : "text-foreground/85"
                  }`}
                >
                  {s.tytul}
                </span>
                {s.opis && (
                  <span className="block text-foreground/50 text-xs md:text-sm mt-1 line-clamp-2">
                    {s.opis}
                  </span>
                )}
              </span>
              <span className="technical text-[9px] text-foreground/30 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}