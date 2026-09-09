import React from "react";
import { Podcast, Youtube, ExternalLink } from "lucide-react";

// Wklej linki do swojego podcastu
const PODCAST_SPOTIFY_URL = "https://open.spotify.com/search/exmortis%20podcast";
const PODCAST_YOUTUBE_URL = "https://www.youtube.com/results?search_query=exmortis+podcast";

// Dodawaj tu odcinki: { title, desc, spotify, youtube }
const EPISODES = [];

const CHANNELS = [
  { label: "Spotify", url: PODCAST_SPOTIFY_URL, icon: Podcast },
  { label: "YouTube", url: PODCAST_YOUTUBE_URL, icon: Youtube },
];

export default function PodcastSection() {
  return (
    <section className="py-32 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">GŁOS · 09</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-6 leading-[0.95]">
          Podcast<br /><span className="gold-text">exmortis</span>
        </h2>
        <p className="text-foreground/60 text-lg max-w-xl mb-12 leading-relaxed">
          Rozmowy o drodze tam i z powrotem. Bez lukru, bez patosu — z ludzi, którzy wrócili.
        </p>

        <div className="flex flex-wrap gap-4 mb-14">
          {CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              <c.icon className="h-4 w-4" /> SŁUCHAJ NA {c.label.toUpperCase()}
            </a>
          ))}
        </div>

        {EPISODES.length > 0 ? (
          <ul className="divide-y hairline border-y hairline">
            {EPISODES.map((ep, i) => (
              <li key={i} className="py-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
                <span className="font-mono text-sm gold-text">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1">
                  <h3 className="relic-heading text-xl">{ep.title}</h3>
                  {ep.desc && <p className="text-foreground/50 text-sm mt-1">{ep.desc}</p>}
                </div>
                <div className="flex gap-2">
                  <a href={ep.spotify} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2 text-[10px]">
                    SPOTIFY <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href={ep.youtube} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2 text-[10px]">
                    YOUTUBE <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border hairline p-10 md:p-14 text-center">
            <p className="relic-heading text-2xl text-foreground/40 mb-3">
              Nowe odcinki wkrótce
            </p>
            <p className="text-foreground/50 text-sm max-w-md mx-auto leading-relaxed">
              Kanał rośnie razem ze wspólnotą. Subskrybuj na Spotify albo YouTube — nie przegapisz pierwszego odcinka.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}