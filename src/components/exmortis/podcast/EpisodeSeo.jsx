import { useEffect } from "react";

// Tytuł, opis i JSON-LD (PodcastEpisode + PodcastSeries) dla strony odcinka.
export default function EpisodeSeo({ ep, settings }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${ep.tytul} — Podcast exmortis #${ep.numer}`;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content");
    meta?.setAttribute("content", ep.opis_krotki || ep.tytul);
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.text = JSON.stringify({
      "@context": "https://schema.org", "@type": "PodcastEpisode", name: ep.tytul, episodeNumber: ep.numer,
      datePublished: ep.publikacja, description: ep.opis_krotki, url: window.location.href.split("?")[0],
      ...(ep.audio ? { associatedMedia: { "@type": "MediaObject", contentUrl: ep.audio } } : {}),
      partOfSeries: { "@type": "PodcastSeries", name: settings?.nazwa || "Podcast exmortis", url: `${window.location.origin}/glos` },
    });
    document.head.appendChild(s);
    return () => { document.title = prev; if (prevDesc != null) meta?.setAttribute("content", prevDesc); s.remove(); };
  }, [ep, settings]);
  return null;
}