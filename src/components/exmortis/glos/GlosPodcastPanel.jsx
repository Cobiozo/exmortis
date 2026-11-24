import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import SubscribeLinks from "@/components/exmortis/podcast/SubscribeLinks";
import QuietSignup from "@/components/exmortis/podcast/QuietSignup";
import EpisodeMedia from "@/components/exmortis/podcast/EpisodeMedia";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";
import { loadPublished, loadSettings, fmtT, syncPodcast, TEMATY } from "@/components/exmortis/podcast/podcastUtils";
import GlosSearch from "./GlosSearch";

const datePl = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");

// Zakładka Podcast jako playlista (19.11.2026) — jak Muzyka: na komputerze po lewej wybrany odcinek z odtwarzaczem
// (przyklejony przy przewijaniu), po prawej lista odcinków z wyszukiwarką, tematami i playlistami. Kliknięcie w liście
// od razu odtwarza odcinek (gdy jest własny plik audio), a po jego końcu startuje następny z listy (kolejka w PlayerContext).
// Odcinki bez pliku audio — odtwarzacz Spotify/YouTube po lewej (EpisodeMedia). Jeden odtwarzacz na stronę bez zmian.
export default function GlosPodcastPanel() {
  const p = usePodcastPlayer();
  const [settings, setSettings] = useState(null);
  const [eps, setEps] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [pl, setPl] = useState("");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState(null);
  // Kolejność listy (19.11.2026): od najnowszych (domyślnie) albo od najstarszych — zapamiętana w tej przeglądarce.
  // Po końcu odcinka odtwarzacz bierze następny w wybranej kolejności (kolejka = widoczna lista).
  const [sort, setSort] = useState(() => { try { return localStorage.getItem("exm_podcast_sort") === "stare" ? "stare" : "nowe"; } catch { return "nowe"; } });
  const pickSort = (v) => { setSort(v); try { localStorage.setItem("exm_podcast_sort", v); } catch { /* bez pamięci */ } };

  useEffect(() => {
    loadSettings().then(setSettings);
    loadPublished().then(setEps);
    // Nowy odcinek w Spotify → pojawia się tu bez ręcznego importu.
    syncPodcast().then((k) => { if (k > 0) loadPublished().then(setEps); });
    base44.entities.PodcastPlaylist.filter({ widoczna: true }, { sort: "kolejnosc", limit: 50 }).then((r) => setPlaylists(r.items));
  }, []);

  const latest = eps?.[0] || null;
  // Wyróżniony w panelu odcinek jest wybrany na start; bez wyróżnienia — najnowszy.
  const featured = eps?.find((e) => e.wyrozniony) || latest;
  const hasTopics = !!eps?.some((e) => e.tematy?.length);

  const shown = useMemo(() => {
    const ids = pl && playlists.find((x) => x.id === pl)?.odcinki;
    let list = ids ? ids.map((id) => (eps || []).find((e) => e.id === id)).filter(Boolean) : eps || [];
    if (topic) list = list.filter((e) => e.tematy?.includes(topic));
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((e) => [e.tytul, e.gosc_nazwa, e.opis_krotki].some((x) => x?.toLowerCase().includes(s)));
    const at = (e) => Date.parse(e.publikacja || 0) || 0;
    const nr = (e) => (Number.isFinite(Number(e.numer)) ? Number(e.numer) : -1);
    const dir = sort === "stare" ? 1 : -1;
    return [...list].sort((a, b) => dir * (at(a) - at(b) || nr(a) - nr(b)));
  }, [eps, playlists, pl, topic, q, sort]);

  // Wybrany odcinek: grający w odtwarzaczu (jeśli z tej listy), kliknięty albo najnowszy.
  const all = eps || [];
  const current = all.find((e) => e.id === (p?.ep?.id && all.some((x) => x.id === p.ep.id) ? p.ep.id : selId)) || featured;
  const queue = shown.length ? shown : all;
  const ci = current ? queue.findIndex((e) => e.id === current.id) : -1;

  const scrollToPlayer = () => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) return;
    const el = document.getElementById("glos-podcast-player");
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const choose = (e, scroll = true) => {
    if (!e) return;
    setSelId(e.id);
    if (e.audio && p) { p.setQueue?.(queue); p.play(e); }
    if (scroll) scrollToPlayer();
  };

  const chip = (on) =>
    `rounded-[var(--exm-r-pill)] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
      on ? "border-exm-gold-line text-exm-ivory" : "border-exm-line text-exm-muted hover:text-exm-ivory"
    }`;
  const ctrl = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--exm-r-field)] border border-exm-line px-4 text-[14px] text-exm-ivory transition-colors hover:border-exm-gold-line disabled:cursor-not-allowed disabled:opacity-40";
  const meta = (e) => [datePl(e.publikacja), e.dlugosc_s && fmtT(e.dlugosc_s), e.gosc_nazwa].filter(Boolean).join(" · ");
  const count = all.length;
  const word = count === 1 ? "odcinek" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "odcinki" : "odcinków";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[54ch] text-[15px] leading-relaxed text-exm-muted">
          Rozmowy z ludźmi, którzy przeszli przez swoją śmierć — i wrócili. Bez lukru, bez patosu.
        </p>
        <SubscribeLinks settings={settings} />
      </div>

      {eps && !latest && (
        <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
          <p className="exm-eyebrow mb-3">Pierwszy odcinek</p>
          <p className="font-exm-serif text-[clamp(1.25rem,2.4vw,1.6rem)] leading-snug text-exm-ivory">
            {settings?.zwiastun_tekst || "Zwiastun — 28 października. Pierwsza rozmowa — 4 listopada."}
          </p>
          <div className="mt-5">
            <QuietSignup button="Daj mi znać o pierwszym odcinku" source="podcast" />
          </div>
        </div>
      )}

      {current && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
          {/* Wybrany odcinek z odtwarzaczem */}
          <article id="glos-podcast-player" className="min-w-0 scroll-mt-[calc(var(--exm-header-h,72px)+12px)] overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface lg:sticky lg:top-[calc(var(--exm-header-h,72px)+16px)]">
            <div className="flex gap-4 p-5 md:gap-5 md:p-6">
              <Image src={current.okladka || settings?.okladka} alt={current.tytul} className="aspect-square w-24 shrink-0 rounded-[var(--exm-r-field)] bg-exm-surface-2 md:w-32" />
              <div className="min-w-0">
                <p className="exm-eyebrow">{p?.ep?.id === current.id && p.playing ? "Teraz gra" : current.wyrozniony ? "Wyróżniony odcinek" : current.id === latest?.id ? "Najnowszy odcinek" : "Odcinek"} · #{current.numer ?? "—"}</p>
                <h3 className="mt-2 font-exm-serif text-[clamp(1.25rem,2.4vw,1.7rem)] leading-[1.15] text-exm-ivory">{current.tytul}</h3>
                {meta(current) && <p className="mt-1.5 text-[13px] text-exm-muted">{meta(current)}</p>}
              </div>
            </div>
            <div className="px-5 pb-5 md:px-6 md:pb-6">
              <EpisodeMedia key={current.id} ep={current} />
              {current.opis_krotki && <p className="mt-4 line-clamp-3 max-w-[62ch] text-[15px] leading-relaxed text-exm-muted">{current.opis_krotki}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className={ctrl} onClick={() => choose(queue[ci - 1], false)} disabled={ci <= 0}>
                  <SkipBack className="h-4 w-4" aria-hidden="true" /> Poprzedni
                </button>
                <button type="button" className={ctrl} onClick={() => choose(queue[ci + 1], false)} disabled={ci < 0 || ci >= queue.length - 1}>
                  Następny <SkipForward className="h-4 w-4" aria-hidden="true" />
                </button>
                <Link to={`/glos/${current.slug}`} className="btn-link">Otwórz odcinek</Link>
              </div>
              {current.audio && <p className="mt-2 text-[12px] text-exm-muted">Odcinki odtwarzają się po kolei — po zakończeniu jednego zaczyna się następny z listy.</p>}
            </div>
          </article>

          {/* Lista odcinków */}
          <section aria-label="Odcinki" className="min-w-0 overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-exm-line px-5 py-4">
              <h2 className="exm-h3">Odcinki</h2>
              <span className="text-[13px] text-exm-muted">{count} {word}</span>
            </div>
            <div className="px-5 pt-4">
              <div role="radiogroup" aria-label="Kolejność odcinków" className="grid grid-cols-2 gap-1 rounded-[var(--exm-r-field)] border border-exm-line p-1">
                {[["nowe", "Od najnowszych"], ["stare", "Od najstarszych"]].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => pickSort(v)}
                    className={`min-h-10 rounded-[calc(var(--exm-r-field)-4px)] px-3 text-[13px] font-medium transition-colors ${sort === v ? "bg-[#C9A24A]/15 text-exm-ivory" : "text-exm-muted hover:text-exm-ivory"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 px-5 pt-4">
              <GlosSearch id="glos-szukaj-odcinkow" label="Szukaj odcinków" value={q} onChange={setQ} placeholder="Tytuł, gość albo opis" />
              {hasTopics && (
                <label className="block">
                  <span className="exm-eyebrow mb-2 block">Temat</span>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-[var(--exm-r-field)] border border-exm-line bg-exm-bg px-3 py-3 text-exm-text">
                    <option value="">Wszystkie tematy</option>
                    {TEMATY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              )}
              {playlists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPl("")} className={chip(!pl)}>Wszystkie</button>
                  {playlists.map((x) => (
                    <button key={x.id} type="button" onClick={() => setPl(x.id)} className={chip(pl === x.id)}>{x.nazwa}</button>
                  ))}
                </div>
              )}
            </div>
            <ol className="mt-3 lg:max-h-[min(62vh,560px)] lg:overflow-y-auto">
              {shown.map((e) => {
                const on = e.id === current.id;
                const live = on && p?.ep?.id === e.id && p.playing;
                return (
                  <li key={e.id} className="border-t border-exm-line first:border-t-0">
                    <button type="button" onClick={() => choose(e)} aria-current={on ? "true" : undefined}
                      aria-label={`${live ? "Teraz gra" : "Odtwórz"}: ${e.tytul}`}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${on ? "bg-[#C9A24A]/10" : "hover:bg-white/[0.03]"}`}>
                      <span className={`w-8 shrink-0 text-center technical text-[11px] ${on ? "text-exm-gold" : "text-exm-muted"}`}>
                        {live ? <Volume2 className="mx-auto h-4 w-4" aria-hidden="true" /> : `#${e.numer ?? "—"}`}
                      </span>
                      {e.okladka && <Image src={e.okladka} alt="" className="hidden aspect-square w-12 shrink-0 rounded-md bg-exm-surface-2 sm:block" />}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-exm-serif text-[17px] leading-snug ${on ? "text-exm-gold" : "text-exm-ivory"}`}>{e.tytul}</span>
                        {meta(e) && <span className="block truncate text-[12px] text-exm-muted">{meta(e)}</span>}
                      </span>
                      <Play className={`h-4 w-4 shrink-0 ${on ? "text-exm-gold" : "text-exm-muted"}`} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="px-5 py-6 text-[15px] text-exm-muted">Brak odcinków dla tego wyboru.</li>}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}