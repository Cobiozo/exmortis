import React from "react";
import { Music, ExternalLink } from "lucide-react";

// Wklej tu swoje prawdziwe linki artysty
const SPOTIFY_URL = "https://open.spotify.com/search/exmortis";
const YOUTUBE_MUSIC_URL = "https://music.youtube.com/search?q=exmortis";

const PLATFORMS = [
  {
    name: "Spotify",
    desc: "Pełna dyskografia powrotu. Playlisty na każdy etap: śmierć, próg, powrót.",
    url: SPOTIFY_URL,
    icon: Music,
  },
  {
    name: "YouTube Music",
    desc: "Te same ścieżki z obrazem. Teledyski i sesje na żywo.",
    url: YOUTUBE_MUSIC_URL,
    icon: Music,
  },
];

export default function MusicSection() {
  return (
    <section className="py-32 px-5 md:px-10 border-y hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">MUZYKA · 02</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-6 leading-[0.95]">
          Muzyka<br /><span className="gold-text">powrotu</span>
        </h2>
        <p className="text-foreground/60 text-lg max-w-xl mb-16 leading-relaxed">
          Są słowa, których nie da się powiedzieć — tylko zagrać. Słuchaj tam, gdzie jesteś.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {PLATFORMS.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="group border hairline p-10 md:p-14 hover:border-[#C9A24A]/60 transition-all duration-500 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <p.icon className="h-8 w-8 gold-text" />
                <ExternalLink className="h-4 w-4 text-foreground/30 group-hover:gold-text transition-colors" />
              </div>
              <h3 className="relic-heading text-2xl md:text-3xl">{p.name}</h3>
              <p className="text-foreground/60 leading-relaxed">{p.desc}</p>
              <span className="technical text-[10px] gold-text mt-auto pt-4">
                SŁUCHAJ TERAZ
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}