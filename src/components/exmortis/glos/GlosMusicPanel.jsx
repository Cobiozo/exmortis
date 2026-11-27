import React, { useEffect, useMemo, useRef, useState } from "react";
import { countPlay } from "@/lib/playStats";
import { ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { SPOTIFY_ARTIST } from "@/lib/spotify";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";
import AdminEditLink from "./AdminEditLink";
import GlosSearch from "./GlosSearch";
import MusicNowCard from "./MusicNowCard";
import MusicRow from "./MusicRow";
import { hasAudio, isPublic, songItem, ytId } from "./musicUtils";

const PLATFORMS = [
  { name: "Spotify", url: SPOTIFY_ARTIST },
  { name: "YouTube Music", url: "https://music.youtube.com/search?q=exmortis" },
];

// Zakładka Muzyka: wybrany utwór po lewej (przyklejony), playlista po prawej.
// Utwory z własnym audio grają we wspólnym odtwarzaczu (dalej między stronami, kolejka = audio z widocznej listy).
// Utwory tylko z YouTube — oficjalny odtwarzacz YouTube; gra zawsze jedno źródło naraz.
// Lista ładuje same dane i okładki — plik audio pobiera się dopiero po kliknięciu „Słuchaj”.
export default function GlosMusicPanel() {
  const consent = useMarketingConsent();
  const p = usePodcastPlayer();
  const [songs, setSongs] = useState(null);
  const [ver, setVer] = useState(0);
  const [idx, setIdx] = useState(-1);
  const [started, setStarted] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [pls, setPls] = useState([]);
  const [pl, setPl] = useState("");

  useEffect(() => {
    base44.entities.PodcastPlaylist.filter({ widoczna: true }, { sort: "kolejnosc", limit: 50 })
      .then((r) => setPls((r.items || []).filter((x) => x.typ === "muzyka" && x.utwory?.length)))
      .catch(() => setPls([]));
  }, []);

  useEffect(() => {
    base44.entities.Utwor
      .filter({ widoczny: true }, { sort: "kolejnosc", limit: 200 })
      .then((r) => setSongs((r.items || []).filter((s) => isPublic(s) && (hasAudio(s) || ytId(s)))))
      .catch(() => setSongs([]));
  }, [ver]);

  const list = songs || [];
  const n = list.length;
  const featured = Math.max(0, list.findIndex((s) => s.wyrozniony));
  // Wspólny odtwarzacz gra utwór z tej listy → to on jest wybrany (także po „Następny” w belce).
  const playingIdx = p?.ep?.kind === "utwor" ? list.findIndex((s) => s.id === p.ep.id) : -1;
  useEffect(() => { if (playingIdx >= 0) { setIdx(playingIdx); setStarted(false); } }, [playingIdx]);
  const cur = n ? Math.min(idx >= 0 ? idx : featured, n - 1) : 0;
  const current = n ? list[cur] : null;
  const live = (s) => !!s && p?.ep?.id === s.id && p.playing;

  // Statystyka filmów YouTube (audio liczy wspólny odtwarzacz): start utworu = muz_<tytuł>, raz na utwór.
  const counted = useRef(null);
  useEffect(() => {
    if (!started || !current || hasAudio(current) || counted.current === current.id) return;
    counted.current = current.id;
    countPlay("muz", current.tytul);
  }, [started, current]);

  const cats = useMemo(() => [...new Set(list.map((s) => s.kategoria).filter(Boolean))], [songs]);
  const s = q.trim().toLowerCase();
  // Wybrana playlista: tylko jej utwory, w jej kolejności (opublikowane — reszta odpada sama).
  const plSel = pls.find((x) => x.id === pl);
  const base = plSel ? plSel.utwory.map((id) => list.find((y) => y.id === id)).filter(Boolean) : list;
  const shown = base.filter((x) => (!cat || x.kategoria === cat) && (!s || [x.tytul, x.opis, x.autor].some((v) => v?.toLowerCase().includes(s))));

  const scrollToPlayer = () => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("glos-player")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const playAt = (i, scroll = true) => {
    if (i < 0 || i >= n) return;
    const x = list[i];
    setIdx(i);
    if (hasAudio(x)) {
      setStarted(false);
      if (p?.ep?.id === x.id) p.toggle();
      else { p.setQueue((shown.length ? shown : list).filter(hasAudio).map(songItem)); p.play(songItem(x), 0); }
    } else {
      setStarted(true);
    }
    if (scroll) scrollToPlayer();
  };
  const chip = (on) => `rounded-[var(--exm-r-pill)] border px-3.5 py-2 text-[13px] font-medium transition-colors ${on ? "border-exm-gold-line text-exm-ivory" : "border-exm-line text-exm-muted hover:text-exm-ivory"}`;

  if (songs === null) return <div className="min-h-[16rem]" aria-hidden="true" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-exm-muted">
          Istnieją słowa, których nie da się wypowiedzieć albo które nie docierają wystarczająco głęboko.
          Dlatego, choć nie jestem muzykiem, tworzę utwory z pomocą AI. W tekstach chcę nieść nadzieję tam,
          gdzie jej zabrakło. Słuchaj tam, gdzie jesteś.
        </p>
        <div className="flex flex-wrap gap-3">
          {PLATFORMS.map((x) => (
            <a key={x.name} href={x.url} target="_blank" rel="noreferrer" className="btn-ghost !min-h-11 !px-4 text-[14px]">
              {x.name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {!current && (
        <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
          <p className="text-[15px] leading-relaxed text-exm-muted">Utwory pojawią się tutaj wkrótce.</p>
        </div>
      )}

      {current && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
          <MusicNowCard
            song={current} pos={cur + 1} n={n} started={started} live={live(current)}
            onStart={() => setStarted(true)} onEnded={() => playAt(cur + 1, false)}
            onListen={() => playAt(cur, false)} onPrev={() => playAt(cur - 1, false)} onNext={() => playAt(cur + 1, false)}
          />
          <section aria-label="Playlista" className="min-w-0 overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-exm-line px-5 py-4">
              <h2 className="exm-h3">Playlista</h2>
              <span className="text-[13px] text-exm-muted">{n} {n === 1 ? "utwór" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "utwory" : "utworów"}</span>
            </div>
            <div className="space-y-3 px-5 pt-4">
              {pls.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Playlisty">
                  <button type="button" onClick={() => setPl("")} aria-pressed={!pl} className={chip(!pl)}>Wszystkie utwory</button>
                  {pls.map((x) => <button key={x.id} type="button" onClick={() => setPl(x.id)} aria-pressed={pl === x.id} className={chip(pl === x.id)}>{x.nazwa}</button>)}
                </div>
              )}
              {plSel?.opis && <p className="text-[14px] leading-relaxed text-exm-muted">{plSel.opis}</p>}
              <GlosSearch id="glos-szukaj-utworow" label="Szukaj utworów" value={q} onChange={setQ} placeholder="Tytuł, autor albo opis" />
              {cats.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setCat("")} className={chip(!cat)}>Wszystkie</button>
                  {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>)}
                </div>
              )}
            </div>
            <ol className="mt-3 lg:max-h-[min(62vh,560px)] lg:overflow-y-auto">
              {shown.map((x) => {
                const i = list.findIndex((y) => y.id === x.id);
                return <MusicRow key={x.id} x={x} i={i} on={i === cur} live={live(x) || (i === cur && !hasAudio(x) && started)} consent={consent} onPick={() => playAt(i)} />;
              })}
              {!shown.length && <li className="px-5 py-6 text-[15px] text-exm-muted">Brak utworów dla tego wyboru.</li>}
            </ol>
          </section>
        </div>
      )}

      <AdminEditLink />
    </div>
  );
}