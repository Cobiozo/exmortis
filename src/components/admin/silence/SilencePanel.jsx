import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SoundLibrary from "./library/SoundLibrary";
import SignalsTab from "./library/SignalsTab";
import SilenceSettingsForm from "./SilenceSettingsForm";
import SilenceModeSettings from "./SilenceModeSettings";
import SilenceStats30 from "./SilenceStats30";
import BackgroundsSection from "./backgrounds/BackgroundsSection";
import { SETTINGS_DEFAULTS } from "@/components/exmortis/cisza/prefs";

// /admin/cisza — tryb, sygnały (biblioteka utworów tylko przy włączonej muzyce), ustawienia, tła, statystyki.
export default function SilencePanel() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    base44.entities.SilenceSettings.filter({}, { limit: 1 }).then((p) => setSettings({ ...SETTINGS_DEFAULTS, ...(p.items[0] || {}) }));
  }, []);

  if (!settings) return <p className="text-foreground/50">Ładowanie…</p>;
  const merge = (s) => setSettings((c) => ({ ...c, ...s }));

  return (
    <div className="space-y-10">
      <SilenceModeSettings settings={settings} onSaved={merge} />
      {settings.muzyka_wlaczona ? <SoundLibrary /> : (
        <section className="space-y-5">
          <h2 className="relic-heading text-2xl">Sygnały (wstęp i zakończenie)</h2>
          <SignalsTab />
        </section>
      )}
      <SilenceSettingsForm settings={settings} onSaved={merge} />
      <BackgroundsSection />
      <SilenceStats30 />
    </div>
  );
}