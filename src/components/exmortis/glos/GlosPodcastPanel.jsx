import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import SubscribeLinks from "@/components/exmortis/podcast/SubscribeLinks";
import QuietSignup from "@/components/exmortis/podcast/QuietSignup";
import EpisodeMedia from "@/components/exmortis/podcast/EpisodeMedia";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";
import { loadPublished, loadSettings, fmtT, syncPodcast, TEMATY } from "@/components/exmortis/podcast/podcastUtils";
import GlosFeatured from "./GlosFeatured";
import GlosRow from "./GlosRow";
import GlosSearch from "./GlosSearch";

const datePl = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");

// Zakładka Podcast: wyróżniony najnowszy odcinek z odtwarzaczem, potem zwarta biblioteka.
// Źródła odcinków, numeracja i odtwarzacz (jeden aktywny, PlayerContext) bez zmian.
export default function GlosPodcastPanel() {
  const p = usePodcastPlayer();
  const [settings, setSettings] = useState(null);
  const [eps, setEps] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [pl, setPl] = useState("");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [n, setN] = useState(10);

  useEffect(() => {
    loadSettings().then(setSettings);
    loadPublished().then(setEps);
    // Nowy odcinek w Spotify → pojawia się tu bez ręcznego importu.
    syncPodcast().then((k) => { if (k > 0) loadPublished().then(setEps); });
    base44.entities.PodcastPlaylist.filter({ widoczna: true }, { sort: "kolejnosc", limit: 50 }).then((r) => setPlaylists(r.items));
  }, []);

  const latest = eps?.[0] || null;
  const hasTopics = !!eps?.some((e) => e.tematy?.length);

  const shown = useMemo(() => {
    const ids = pl && playlists.find((x) => x.id === pl)?.odcinki;
    let list = ids ? ids.map((id) => (eps || []).find((e) => e.id === id)).filter(Boolean) : eps || [];
    if (topic) list = list.filter((e) => e.tematy?.includes(topic));
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((e) => [e.tytul, e.gosc_nazwa, e.opis_krotki].some((x) => x?.toLowerCase().includes(s)));
    return list;
  }, [eps, playlists, pl, topic, q]);

  const chip = (on) =>
    `rounded-[var(--exm-r-pill)] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
      on ? "border-exm-gold-line text-exm-ivory" : "border-exm-line text-exm-muted hover:text-exm-ivory"
    }`;

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

      {latest && (
        <>
          <GlosFeatured
            media={
              <Image
                src={latest.okladka || settings?.okladka}
                alt={latest.tytul}
                className="aspect-square h-full w-full bg-exm-surface-2"
              />
            }
            eyebrow={`Najnowszy odcinek · #${latest.numer ?? "—"}`}
            title={latest.tytul}
            meta={[datePl(latest.publikacja), latest.dlugosc_s && fmtT(latest.dlugosc_s), latest.gosc_nazwa].filter(Boolean).join(" · ")}
            desc={latest.opis_krotki}
            footer={
              <>
                <EpisodeMedia ep={latest} />
                <Link to={`/glos/${latest.slug}`} className="btn-link mt-1">Otwórz odcinek</Link>
              </>
            }
          />

          <div className="mt-10">
            <h2 className="exm-h3">Wszystkie odcinki</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <GlosSearch
                id="glos-szukaj-odcinkow"
                label="Szukaj odcinków"
                value={q}
                onChange={setQ}
                placeholder="Tytuł, gość albo opis"
              />
              {hasTopics && (
                <label className="block">
                  <span className="exm-eyebrow mb-2 block">Temat</span>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="rounded-[var(--exm-r-field)] border border-exm-line bg-exm-bg px-3 py-3 text-exm-text"
                  >
                    <option value="">Wszystkie tematy</option>
                    {TEMATY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              )}
            </div>

            {playlists.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPl("")} className={chip(!pl)}>Wszystkie</button>
                {playlists.map((x) => (
                  <button key={x.id} type="button" onClick={() => setPl(x.id)} className={chip(pl === x.id)}>{x.nazwa}</button>
                ))}
              </div>
            )}

            <ul className="mt-4 border-t border-exm-line">
              {shown.slice(0, n).map((e) => (
                <GlosRow
                  key={e.id}
                  number={`#${e.numer ?? "—"}`}
                  title={e.tytul}
                  href={`/glos/${e.slug}`}
                  meta={[datePl(e.publikacja), e.dlugosc_s && fmtT(e.dlugosc_s), e.gosc_nazwa].filter(Boolean).join(" · ")}
                  desc={e.opis_krotki}
                  cover={
                    e.okladka ? (
                      <Image
                        src={e.okladka}
                        alt=""
                        className="hidden aspect-square w-16 shrink-0 rounded-[var(--exm-r-field)] bg-exm-surface-2 sm:block"
                      />
                    ) : null
                  }
                  action={
                    e.audio ? (
                      <button
                        type="button"
                        onClick={() => p.play(e)}
                        aria-label={`Odtwórz: ${e.tytul}`}
                        className="btn-ghost w-full !min-h-11 !px-4 text-[14px] sm:w-auto"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" /> Odtwórz
                      </button>
                    ) : (
                      <Link to={`/glos/${e.slug}`} className="btn-ghost w-full !min-h-11 !px-4 text-[14px] sm:w-auto">
                        Otwórz odcinek
                      </Link>
                    )
                  }
                />
              ))}
              {!shown.length && (
                <li className="py-6 text-[15px] text-exm-muted">Brak odcinków dla tego wyboru.</li>
              )}
            </ul>

            {shown.length > n && (
              <button type="button" onClick={() => setN(n + 10)} className="btn-link mt-4">Pokaż więcej</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}