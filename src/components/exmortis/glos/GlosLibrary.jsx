import React, { useEffect, useState } from "react";
import Container from "@/components/exmortis/ui/Container";
import GlosTabs from "./GlosTabs";
import GlosPodcastPanel from "./GlosPodcastPanel";
import GlosMusicPanel from "./GlosMusicPanel";

// /glos — jedna sekcja z zakładkami Podcast / Muzyka zamiast dwóch długich modułów.
// Adres z kotwicą #podcast albo #muzyka otwiera właściwą zakładkę (także po zmianie w pasku adresu).
const KEYS = ["podcast", "muzyka"];

function fromHash() {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace("#", "");
  return KEYS.includes(h) ? h : "podcast";
}

export default function GlosLibrary() {
  const [tab, setTab] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = (key) => {
    setTab(key);
    try { window.history.replaceState(null, "", `#${key}`); } catch { /* bez zmiany adresu */ }
  };

  return (
    <section className="pb-[var(--exm-section-y)]">
      {/* Kotwice dla istniejących odnośników /glos#podcast i /glos#muzyka. */}
      <span id="podcast" aria-hidden="true" />
      <span id="muzyka" aria-hidden="true" />
      <Container>
        <GlosTabs value={tab} onChange={choose} />
        {/* Obie zakładki zostają w drzewie: przełączenie nie zatrzymuje muzyki ani odtwarzacza podcastu. */}
        <div id="glos-panel-podcast" role="tabpanel" aria-labelledby="glos-tab-podcast" hidden={tab !== "podcast"} className="mt-8">
          <GlosPodcastPanel />
        </div>
        <div id="glos-panel-muzyka" role="tabpanel" aria-labelledby="glos-tab-muzyka" hidden={tab !== "muzyka"} className="mt-8">
          <GlosMusicPanel />
        </div>
      </Container>
    </section>
  );
}