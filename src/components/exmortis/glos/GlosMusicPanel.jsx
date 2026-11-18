import React, { useEffect, useState } from "react";
import { ExternalLink, Music, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { SPOTIFY_ARTIST } from "@/lib/spotify";
import { extractVideoId, thumbUrl } from "./youtube";
import GlosPlayer from "./GlosPlayer";
import PlaylistManager from "./PlaylistManager";
import GlosFeatured from "./GlosFeatured";
import GlosRow from "./GlosRow";
import GlosSearch from "./GlosSearch";

// Linki platform z jednego źródła (src/lib/spotify.js) — muzyka prowadzi do profilu artysty.
const YOUTUBE_MUSIC_URL = "https://music.youtube.com/search?q=exmortis";
const PLATFORMS = [
  { name: "Spotify", url: SPOTIFY_ARTIST },
  { name: "YouTube Music", url: YOUTUBE_MUSIC_URL },
];

const datePl = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");

// Zakładka Muzyka: wyróżniony utwór z odtwarzaczem (stan przed zgodą bez zmian — GlosPlayer),
// potem zwarta lista utworów. Źródło utworów i kolejność bez zmian.
export default function GlosMusicPanel() {
  const consent = useMarketingConsent();
  const [songs, setSongs] = useState(null);
  const [ver, setVer] = useState(0);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    base44.entities.Utwor
      .filter({ widoczny: true }, { sort: "kolejnosc", limit: 100 })
      .then((r) => setSongs((r.items || []).filter((s) => extractVideoId(s.youtube_url))))
      .catch(() => setSongs([]));
  }, [ver]);

  const list = songs || [];
  const current = list.length ? list[Math.min(idx, list.length - 1)] : null;
  const s = q.trim().toLowerCase();
  const shown = s ? list.filter((x) => [x.tytul, x.opis].some((v) => v?.toLowerCase().includes(s))) : list;

  const scrollToPlayer = () => {
    const el = document.getElementById("glos-player");
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };
  const play = (song) => {
    const i = list.findIndex((x) => x.id === song.id);
    if (i < 0) return;
    setIdx(i);
    setStarted(true);
    scrollToPlayer();
  };

  const platforms = (
    <div className="flex flex-wrap gap-3">
      {PLATFORMS.map((x) => (
        <a key={x.name} href={x.url} target="_blank" rel="noreferrer" className="btn-ghost !min-h-11 !px-4 text-[14px]">
          {x.name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ))}
    </div>
  );

  if (songs === null) return <div className="min-h-[16rem]" aria-hidden="true" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-exm-muted">
          Istnieją słowa, których nie da się wypowiedzieć albo które nie docierają wystarczająco głęboko.
          Dlatego, choć nie jestem muzykiem, tworzę utwory z pomocą AI. W tekstach chcę nieść nadzieję tam,
          gdzie jej zabrakło. Słuchaj tam, gdzie jesteś.
        </p>
        {platforms}
      </div>

      {!current && (
        <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
          <p className="text-[15px] leading-relaxed text-exm-muted">Utwory pojawią się tutaj wkrótce.</p>
        </div>
      )}

      {current && (
        <>
          <GlosFeatured
            layout="video"
            media={
              <div id="glos-player" className="min-w-0">
                <GlosPlayer
                  videoId={extractVideoId(current.youtube_url) || ""}
                  started={started}
                  onStart={() => setStarted(true)}
                  onEnded={() => setIdx((i) => (i + 1 < list.length ? i + 1 : i))}
                />
              </div>
            }
            eyebrow={`Utwór ${idx + 1} z ${list.length}`}
            title={current.tytul}
            meta={datePl(current.data_dodania)}
            desc={current.opis}
          />

          <div className="mt-10">
            <h2 className="exm-h3">Wszystkie utwory</h2>
            <div className="mt-4">
              <GlosSearch
                id="glos-szukaj-utworow"
                label="Szukaj utworów"
                value={q}
                onChange={setQ}
                placeholder="Tytuł albo opis"
              />
            </div>

            <ul className="mt-4 border-t border-exm-line">
              {shown.map((x) => {
                const i = list.findIndex((y) => y.id === x.id);
                const id = extractVideoId(x.youtube_url);
                return (
                  <GlosRow
                    key={x.id}
                    number={String(i + 1).padStart(2, "0")}
                    title={x.tytul}
                    meta={datePl(x.data_dodania)}
                    desc={x.opis}
                    cover={
                      <span className="hidden aspect-video w-24 shrink-0 overflow-hidden rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface-2 sm:flex sm:items-center sm:justify-center">
                        {consent && id ? (
                          <img src={thumbUrl(id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <Music className="h-5 w-5 text-exm-muted" aria-hidden="true" />
                        )}
                      </span>
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => play(x)}
                        aria-label={`Odtwórz: ${x.tytul}`}
                        className="btn-ghost w-full !min-h-11 !px-4 text-[14px] sm:w-auto"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" /> Odtwórz
                      </button>
                    }
                  />
                );
              })}
              {!shown.length && <li className="py-6 text-[15px] text-exm-muted">Brak utworów dla tego wyboru.</li>}
            </ul>
          </div>
        </>
      )}

      <PlaylistManager onMutate={() => setVer((v) => v + 1)} />
    </div>
  );
}