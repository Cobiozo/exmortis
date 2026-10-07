import React, { useState } from "react";
import TracksTab from "./TracksTab";
import SignalsTab from "./SignalsTab";
import { MAX_MB } from "./libUtils";

// /admin/cisza → Biblioteka dźwięków: utwory niezależne od czasu + sygnały.
export default function SoundLibrary() {
  const [tab, setTab] = useState("tracks");
  const btn = (id) => `technical text-[10px] px-4 py-2 border-b-2 ${tab === id ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50 hover:text-foreground"}`;
  return (
    <section className="space-y-5">
      <div>
        <h2 className="relic-heading text-2xl">Biblioteka dźwięków</h2>
        <p className="text-xs text-foreground/45 mt-2">Każdy utwór działa z każdym czasem minutnika. MP3 lub M4A, do {MAX_MB} MB na plik — godzina w AAC 64–96 kb/s się mieści.</p>
      </div>
      <div className="flex gap-2 border-b hairline">
        <button onClick={() => setTab("tracks")} className={btn("tracks")}>Utwory</button>
        <button onClick={() => setTab("signals")} className={btn("signals")}>Sygnały (wstęp i zakończenie)</button>
      </div>
      {tab === "tracks" ? <TracksTab /> : <SignalsTab />}
    </section>
  );
}