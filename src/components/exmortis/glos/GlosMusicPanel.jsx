import React, { useEffect, useRef, useState } from "react";
import { countPlay } from "@/lib/playStats";
import { ExternalLink, Music, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { SPOTIFY_ARTIST } from "@/lib/spotify";
import { extractVideoId, thumbUrl } from "./youtube";
import GlosPlayer from "./GlosPlayer";
import PlaylistManager from "./PlaylistManager";
import GlosSearch from "./GlosSearch";

// Linki platform z jednego źródła (src/lib/spotify.js) — muzyka prowadzi do profilu artysty.
const YOUTUBE_MUSIC_URL = "https://music.youtube.com/search?q=exmortis";
const PLATFORMS = [
  { name: "Spotify", url: SPOTIFY_ARTIST },
  { name: "YouTube Music", url: YOUTUBE_MUSIC_URL },
];

const datePl = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");

// Zakładka Muzyka jako playlista (19.11.2026): na komputerze odtwarzacz po lewej (przyklejony), lista po prawej
// z wyróżnionym utworem, który teraz gra. Utwory lecą po kolei same (koniec utworu → następny), są przyciski
// „Poprzedni” / „Następny”, a kliknięcie w liście od razu odtwarza — bez przewijania na komputerze.
// Przed zgodą i przed pierwszym kliknięciem nic nie łączy się z YouTube (GlosPlayer bez zmian).
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
  const n = list.length;
  const cur = n ? Math.min(idx, n - 1) : 0;
  const current = n ? list[cur] : null;
  // Statystyka w panelu: start każdego utworu (kliknięcie albo przejście do następnego) = muz_<tytuł>, raz na utwór.
  const counted = useRef(null);
  useEffect(() => {
    if (!started || !current || counted.current === current.id) return;
    counted.current = current.id;
    countPlay("muz", current.tytul);
  }, [started, current]);
  const s = q.trim().toLowerCase();
  const shown = s ? list.filter((x) => [x.tytul, x.opis].some((v) => v?.toLowerCase().includes(s))) : list;

  // Na telefonie odtwarzacz jest nad listą — po wyborze utworu przewijamy do niego. Na komputerze stoi obok.
  const scrollToPlayer = () => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) return;
    const el = document.getElementById("glos-player");
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const playAt = (i, scroll = true) => {
    if (i < 0 || i >= n) return;
    setIdx(i);
    setStarted(true);
    if (scroll) scrollToPlayer();
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

  const ctrl = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--exm-r-field)] border border-exm-line px-4 text-[14px] text-exm-ivory transition-colors hover:border-exm-gold-line disabled:cursor-not-allowed disabled:opacity-40";

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
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
          {/* Odtwarzacz */}
          <article id="glos-player" className="min-w-0 scroll-mt-[calc(var(--exm-header-h,72px)+12px)] overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface lg:sticky lg:top-[calc(var(--exm-header-h,72px)+16px)]">
            <div className="bg-exm-surface-2 p-3 md:p-4">
              <GlosPlayer
                videoId={extractVideoId(current.youtube_url) || ""}
                started={started}
                onStart={() => setStarted(true)}
                onEnded={() => setIdx((i) => (i + 1 < n ? i + 1 : i))}
              />
            </div>
            <div className="flex flex-col gap-2 p-5 md:p-6">
              <p className="exm-eyebrow">{started ? "Teraz gra" : "Pierwszy na liście"} · {cur + 1} z {n}</p>
              <h3 className="font-exm-serif text-[clamp(1.35rem,2.6vw,1.85rem)] leading-[1.15] text-exm-ivory">{current.tytul}</h3>
              {current.data_dodania && <p className="text-[13px] text-exm-muted">{datePl(current.data_dodania)}</p>}
              {current.opis && <p className="line-clamp-3 max-w-[62ch] text-[15px] leading-relaxed text-exm-muted">{current.opis}</p>}
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className={ctrl} onClick={() => playAt(cur - 1, false)} disabled={cur === 0}>
                  <SkipBack className="h-4 w-4" aria-hidden="true" /> Poprzedni
                </button>
                {!started && (
                  <button type="button" className="btn-relic !min-h-11 !px-5 text-[14px]" onClick={() => setStarted(true)}>
                    <Play className="h-4 w-4" aria-hidden="true" /> Odtwarzaj po kolei
                  </button>
                )}
                <button type="button" className={ctrl} onClick={() => playAt(cur + 1, false)} disabled={cur >= n - 1}>
                  Następny <SkipForward className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1 text-[12px] text-exm-muted">Utwory odtwarzają się po kolei — po zakończeniu jednego zaczyna się następny.</p>
            </div>
          </article>

          {/* Playlista */}
          <section aria-label="Playlista" className="min-w-0 overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-exm-line px-5 py-4">
              <h2 className="exm-h3">Playlista</h2>
              <span className="text-[13px] text-exm-muted">{n} {n === 1 ? "utwór" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "utwory" : "utworów"}</span>
            </div>
            <div className="px-5 pt-4">
              <GlosSearch id="glos-szukaj-utworow" label="Szukaj utworów" value={q} onChange={setQ} placeholder="Tytuł albo opis" />
            </div>
            <ol className="mt-3 lg:max-h-[min(62vh,560px)] lg:overflow-y-auto">
              {shown.map((x) => {
                const i = list.findIndex((y) => y.id === x.id);
                const id = extractVideoId(x.youtube_url);
                const on = i === cur;
                return (
                  <li key={x.id} className="border-t border-exm-line first:border-t-0">
                    <button
                      type="button"
                      onClick={() => playAt(i)}
                      aria-current={on ? "true" : undefined}
                      aria-label={`${on && started ? "Teraz gra" : "Odtwórz"}: ${x.tytul}`}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${on ? "bg-[#C9A24A]/10" : "hover:bg-white/[0.03]"}`}
                    >
                      <span className={`w-6 shrink-0 text-center technical text-[11px] ${on ? "text-exm-gold" : "text-exm-muted"}`}>
                        {on && started ? <Volume2 className="mx-auto h-4 w-4" aria-hidden="true" /> : String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="hidden aspect-video w-16 shrink-0 overflow-hidden rounded-md border border-exm-line bg-exm-surface-2 sm:flex sm:items-center sm:justify-center">
                        {consent && id ? (
                          <img src={thumbUrl(id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <Music className="h-4 w-4 text-exm-muted" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-exm-serif text-[17px] leading-snug ${on ? "text-exm-gold" : "text-exm-ivory"}`}>{x.tytul}</span>
                        {x.data_dodania && <span className="block text-[12px] text-exm-muted">{datePl(x.data_dodania)}</span>}
                      </span>
                      <Play className={`h-4 w-4 shrink-0 ${on ? "text-exm-gold" : "text-exm-muted"}`} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="px-5 py-6 text-[15px] text-exm-muted">Brak utworów dla tego wyboru.</li>}
            </ol>
          </section>
        </div>
      )}

      <PlaylistManager onMutate={() => setVer((v) => v + 1)} />
    </div>
  );
}
