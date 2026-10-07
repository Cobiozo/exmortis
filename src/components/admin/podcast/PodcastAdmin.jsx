import React, { useState } from "react";
import EpisodesTab from "./EpisodesTab";
import PlaylistsTab from "./PlaylistsTab";
import GuestsTab from "./GuestsTab";
import SettingsTab from "./SettingsTab";

const TABS = [["odcinki", "Odcinki", EpisodesTab], ["playlisty", "Playlisty", PlaylistsTab], ["goscie", "Goście", GuestsTab], ["ustawienia", "Ustawienia", SettingsTab]];

export default function PodcastAdmin() {
  const [tab, setTab] = useState("odcinki");
  const Cur = TABS.find((t) => t[0] === tab)[2];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b hairline">
        {TABS.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`technical text-[10px] px-4 py-2 border-b-2 ${tab === id ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50"}`}>{l}</button>)}
      </div>
      <Cur />
    </div>
  );
}