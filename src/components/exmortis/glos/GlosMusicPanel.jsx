import React, { useEffect, useMemo, useRef, useState } from "react";
import { countPlay } from "@/lib/playStats";
import { ExternalLink, Repeat, Repeat1, Shuffle } from "lucide-react";
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
  const [curId, setCurId] = useState(null);
  const [replay, setReplay] = useState(0); // powtórzenie filmu YouTube (nowe zamontowanie odtwarzacza)
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
  const s = q.trim().toLowerCase();
  const plSel = pls.find((x) => x.id === pl);

  // Kolejność (27.11.2026): wybrana playlista — jej utwory w jej kolejności; „Wszystkie utwory” — po kolei playlisty
  // (w kolejności z panelu), każdy utwór raz, na końcu utwory spoza playlist. Numeracja zawsze od 1.
  const groups = useMemo(() => {
    const byId = new Map(list.map((x) => [x.id, x]));
    if (plSel) return [{ key: plSel.id, title: "", items: (plSel.utwory || []).map((id) => byId.get(id)).filter(Boolean) }];
    const seen = new Set();
    const out = [];
    for (const x of pls) {
      const items = (x.utwory || []).map((id) => byId.get(id)).filter((y) => y && !seen.has(y.id));
      items.forEach((y) => seen.add(y.id));
      if (items.length) out.push({ key: x.id, title: x.nazwa, items });
    }
    const rest = list.filter((y) => !seen.has(y.id));
    if (rest.length) out.push({ key: "reszta", title: out.length ? "Pozostałe utwory" : "", items: rest });
    return out;
  }, [list, pls, plSel]);
  const order = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const n = order.length;
  const matches = (x) => (!cat || x.kategoria === cat) && (!s || [x.tytul, x.opis, x.autor].some((v) => v?.toLowerCase().includes(s)));
  const shown = order.filter(matches);
  const filtering = !!(cat || s);

  // Bieżący utwór (po id): grający we wspólnym odtwarzaczu, wybrany albo wyróżniony.
  const playingId = p?.ep?.kind === "utwor" ? p.ep.id : null;
  useEffect(() => { if (playingId && list.some((x) => x.id === playingId)) { setCurId(playingId); setStarted(false); } }, [playingId, songs]);
  const current = list.find((x) => x.id === curId) || order.find((x) => x.wyrozniony) || order[0] || null;
  const cur = current ? order.findIndex((x) => x.id === current.id) : -1;
  const live = (x) => !!x && p?.ep?.id === x.id && p.playing;
  const shuffle = !!p?.shuffle;
  const repeat = p?.repeat || "off";

  // Statystyka filmów YouTube (audio liczy wspólny odtwarzacz): start utworu = muz_<tytuł>, raz na utwór.
  const counted = useRef(null);
  useEffect(() => {
    if (!started || !current || hasAudio(current) || counted.current === `${current.id}:${replay}`) return;
    counted.current = `${current.id}:${replay}`;
    countPlay("muz", current.tytul);
  }, [started, current, replay]);

  const cats = useMemo(() => [...new Set(list.map((x) => x.kategoria).filter(Boolean))], [songs]);

  const scrollToPlayer = () => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("glos-player")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const playAt = (i, scroll = true) => {
    if (i < 0 || i >= n) return;
    const x = order[i];
    setCurId(x.id);
    if (hasAudio(x)) {
      setStarted(false);
      if (p?.ep?.id === x.id) p.toggle();
      else { p.setQueue((filtering && shown.length ? shown : order).filter(hasAudio).map(songItem)); p.play(songItem(x), 0); }
    } else {
      setStarted(true);
    }
    if (scroll) scrollToPlayer();
  };
  // Następny / poprzedni z uwzględnieniem trybów: losowo (inny niż bieżący) i powtarzanie wszystkich (zawijanie).
  const stepIdx = (dir) => {
    if (!n) return -1;
    if (shuffle && n > 1) { let j = cur; while (j === cur) j = Math.floor(Math.random() * n); return j; }
    const j = cur + dir;
    if (j >= 0 && j < n) return j;
    return repeat === "all" ? (dir > 0 ? 0 : n - 1) : -1;
  };
  const go = (dir) => {
    // Utwór z audio grany we wspólnym odtwarzaczu — ten sam porządek co belka (kolejka, losowo, powtarzanie).
    if (current && hasAudio(current) && p?.ep?.id === current.id && (dir > 0 ? p.hasNext : p.hasPrev)) { dir > 0 ? p.next() : p.prev(); return; }
    playAt(stepIdx(dir), false);
  };
  // Koniec filmu YouTube: powtórz utwór albo przejdź dalej.
  const onEnded = () => {
    if (repeat === "one") { setReplay((r) => r + 1); setStarted(true); return; }
    const j = stepIdx(1);
    if (j >= 0) playAt(j, false);
  };
  const canPrev = cur > 0 || shuffle || repeat === "all";
  const canNext = (cur >= 0 && cur < n - 1) || shuffle || repeat === "all";
  const countLabel = (k) => `${k} ${k === 1 ? "utwór" : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? "utwory" : "utworów"}`;
  const modeBtn = (on) => `inline-flex min-h-9 items-center gap-1.5 rounded-[var(--exm-r-pill)] border px-3 text-[13px] transition-colors ${on ? "border-exm-gold-line bg-[#C9A24A]/10 text-exm-gold" : "border-exm-line text-exm-muted hover:text-exm-ivory"}`;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

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
            key={`${current.id}:${replay}`}
            song={current} pos={cur + 1} n={n} started={started} live={live(current)} canPrev={canPrev} canNext={canNext}
            onStart={() => setStarted(true)} onEnded={onEnded}
            onListen={() => (cur >= 0 ? playAt(cur, false) : null)} onPrev={() => go(-1)} onNext={() => go(1)}
          />
          <section aria-label="Playlista" className="min-w-0 overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-exm-line px-5 py-4">
              <h2 className="exm-h3">{plSel ? plSel.nazwa : "Playlista"}</h2>
              <span className="text-[13px] text-exm-muted">{countLabel(n)}</span>
            </div>
            <div className="space-y-3 px-5 pt-4">
              {pls.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Playlisty">
                  <button type="button" onClick={() => setPl("")} aria-pressed={!pl} className={chip(!pl)}>Wszystkie utwory</button>
                  {pls.map((x) => <button key={x.id} type="button" onClick={() => setPl(x.id)} aria-pressed={pl === x.id} className={chip(pl === x.id)}>{x.nazwa}</button>)}
                </div>
              )}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tryb odtwarzania">
                <button type="button" onClick={() => p?.setShuffle(!shuffle)} aria-pressed={shuffle} className={modeBtn(shuffle)}>
                  <Shuffle className="h-4 w-4" aria-hidden="true" /> Losowo
                </button>
                <button type="button" onClick={() => p?.cycleRepeat()} aria-pressed={repeat !== "off"} className={modeBtn(repeat !== "off")}
                  aria-label={`Powtarzanie: ${repeat === "one" ? "utworu" : repeat === "all" ? "wszystkich" : "wyłączone"}. Kliknij, aby zmienić.`}>
                  <RepeatIcon className="h-4 w-4" aria-hidden="true" /> {repeat === "one" ? "Powtarzaj utwór" : repeat === "all" ? "Powtarzaj wszystkie" : "Powtarzanie wył."}
                </button>
              </div>
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
              {groups.map((g) => {
                const items = g.items.filter(matches);
                if (!items.length) return null;
                return (
                  <React.Fragment key={g.key}>
                    {g.title && !filtering && groups.length > 1 && (
                      <li role="presentation" className="border-t border-exm-line bg-exm-surface-2/60 px-5 py-2 first:border-t-0">
                        <span className="technical text-[10px] text-exm-gold">{g.title.toUpperCase()}</span>
                      </li>
                    )}
                    {items.map((x) => {
                      const i = order.findIndex((y) => y.id === x.id);
                      return <MusicRow key={x.id} x={x} i={i} on={i === cur} live={live(x) || (i === cur && !hasAudio(x) && started)} consent={consent} onPick={() => playAt(i)} />;
                    })}
                  </React.Fragment>
                );
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