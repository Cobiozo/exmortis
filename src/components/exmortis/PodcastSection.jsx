import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import SubscribeLinks from "./podcast/SubscribeLinks";
import QuietSignup from "./podcast/QuietSignup";
import EpisodeList from "./podcast/EpisodeList";
import { loadPublished, loadSettings, fmtT } from "./podcast/podcastUtils";

export default function PodcastSection() {
  const [settings, setSettings] = useState(null);
  const [eps, setEps] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  useEffect(() => {
    loadSettings().then(setSettings);
    loadPublished().then(setEps);
    base44.entities.PodcastPlaylist.filter({ widoczna: true }, { sort: "kolejnosc", limit: 50 }).then((p) => setPlaylists(p.items));
  }, []);
  const latest = eps?.[0];

  return (
    <section id="podcast" className="py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">PODCAST · 03</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-6 leading-[0.95]">
          <span className="text-[#F5EFE1]">Podcast</span><br /><span className="gold-text">exmortis</span>
        </h2>
        <p className="text-foreground/60 text-lg max-w-xl mb-10 leading-relaxed">
          Rozmowy z ludźmi, którzy przeszli przez swoją śmierć — i wrócili. Bez lukru, bez patosu.
        </p>
        <div className="mb-14"><SubscribeLinks settings={settings} /></div>

        {eps && !latest && (
          <div className="border border-[#C9A24A]/40 p-8 md:p-14 space-y-8">
            <p className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug">{settings?.zwiastun_tekst || "Zwiastun — 28 października. Pierwsza rozmowa — 4 listopada."}</p>
            <QuietSignup button="Daj mi znać o pierwszym odcinku" source="podcast" />
          </div>
        )}

        {latest && (
          <div className="space-y-16">
            <Link to={`/glos/${latest.slug}`} className="grid md:grid-cols-[minmax(0,360px)_1fr] gap-8 md:gap-12 border hairline p-6 md:p-10 group">
              <Image src={latest.okladka || settings?.okladka} alt={latest.tytul} className="aspect-square w-full bg-[#121212]" />
              <div className="flex flex-col justify-center">
                <p className="technical text-[10px] gold-text mb-3">NAJNOWSZY · #{latest.numer}</p>
                <h3 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] group-hover:text-[#C9A24A] mb-3">{latest.tytul}</h3>
                <p className="text-sm text-foreground/45 mb-5">{[latest.gosc_nazwa, latest.dlugosc_s && fmtT(latest.dlugosc_s)].filter(Boolean).join(" · ")}</p>
                {latest.opis_krotki && <p className="text-foreground/65 leading-relaxed mb-8 max-w-xl">{latest.opis_krotki}</p>}
                <span className="btn-relic self-start">Słuchaj</span>
              </div>
            </Link>
            <EpisodeList episodes={eps} playlists={playlists} />
          </div>
        )}
      </div>
    </section>
  );
}