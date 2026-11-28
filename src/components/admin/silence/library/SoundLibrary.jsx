import React, { useState } from "react";
import TracksTab from "./TracksTab";
import SignalsTab from "./SignalsTab";
import { MAX_MB } from "./libUtils";
import { ViewTabs } from "@/components/admin/ui/kit";

// /admin/cisza → Biblioteka dźwięków: utwory niezależne od czasu + sygnały.
export default function SoundLibrary() {
  const [tab, setTab] = useState("tracks");
  return (
    <section className="space-y-5">
      <div>
        <h2 className="relic-heading text-2xl">Biblioteka dźwięków</h2>
        <p className="text-xs text-foreground/45 mt-2">Każdy utwór działa z każdym czasem minutnika. MP3 lub M4A, do {MAX_MB} MB na plik — godzina w AAC 64–96 kb/s się mieści.</p>
      </div>
      <ViewTabs tabs={[["tracks", "Utwory"], ["signals", "Sygnały (wstęp i zakończenie)"]]} value={tab} onChange={setTab} label="Biblioteka dźwięków" />
      {tab === "tracks" ? <TracksTab /> : <SignalsTab />}
    </section>
  );
}