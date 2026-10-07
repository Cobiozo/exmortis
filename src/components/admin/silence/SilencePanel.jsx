import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SoundLibrary from "./library/SoundLibrary";
import SilenceSettingsForm from "./SilenceSettingsForm";
import SilenceStats30 from "./SilenceStats30";
import BackgroundsSection from "./backgrounds/BackgroundsSection";
import { SETTINGS_DEFAULTS } from "@/components/exmortis/cisza/prefs";

// /admin/cisza — biblioteka dźwięków, ustawienia, tła, statystyki.
export default function SilencePanel() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    base44.entities.SilenceSettings.filter({}, { limit: 1 }).then((p) => setSettings({ ...SETTINGS_DEFAULTS, ...(p.items[0] || {}) }));
  }, []);

  if (!settings) return <p className="text-foreground/50">Ładowanie…</p>;

  return (
    <div className="space-y-10">
      <SoundLibrary />
      <SilenceSettingsForm settings={settings} onSaved={(s) => setSettings({ ...settings, ...s })} />
      <BackgroundsSection />
      <SilenceStats30 />
    </div>
  );
}