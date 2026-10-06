import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import TimeCard from "./TimeCard";
import CopyIntroOutro from "./CopyIntroOutro";
import SilenceSettingsForm from "./SilenceSettingsForm";
import SilenceStats30 from "./SilenceStats30";
import { ST, TIMES, MAX_MB } from "./silenceUtils";
import { SETTINGS_DEFAULTS } from "@/components/exmortis/cisza/prefs";

// /admin/cisza — podkłady dla sześciu czasów, ustawienia, statystyki.
export default function SilencePanel() {
  const [tracks, setTracks] = useState(null);
  const [settings, setSettings] = useState(null);
  const load = () => ST.filter({}, { sort: "kolejnosc", limit: 200 }).then((p) => setTracks(p.items));

  useEffect(() => {
    load();
    base44.entities.SilenceSettings.filter({}, { limit: 1 }).then((p) => setSettings({ ...SETTINGS_DEFAULTS, ...(p.items[0] || {}) }));
  }, []);

  if (!tracks || !settings) return <p className="text-foreground/50">Ładowanie…</p>;
  const fadeMs = Number(settings.wyciszanie_melodii_s ?? 3) * 1000;

  return (
    <div className="space-y-10">
      <p className="text-xs text-foreground/45">Pliki MP3 lub M4A, maksymalnie {MAX_MB} MB na plik.</p>
      <div className="grid xl:grid-cols-2 gap-6">
        {TIMES.map((m) => (
          <TimeCard key={m} minutes={m} tracks={tracks.filter((t) => t.czas_min === m)} reload={load} fadeMs={fadeMs} />
        ))}
      </div>
      <CopyIntroOutro tracks={tracks} reload={load} />
      <SilenceSettingsForm settings={settings} onSaved={(s) => setSettings({ ...settings, ...s })} />
      <SilenceStats30 />
    </div>
  );
}