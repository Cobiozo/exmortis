import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CiszaChoose from "@/components/exmortis/cisza/CiszaChoose";
import CiszaSession from "@/components/exmortis/cisza/CiszaSession";
import CiszaEnd from "@/components/exmortis/cisza/CiszaEnd";
import { useReducedMotion } from "@/components/exmortis/cisza/motion";
import { TIMES, SETTINGS_DEFAULTS, loadPrefs, savePrefs, resolveBg } from "@/components/exmortis/cisza/prefs";
import { useAdminMode } from "@/components/admin/AdminModeContext";

// Minutnik ciszy — osobna strona bez logowania.
export default function Cisza() {
  const reduced = useReducedMotion();
  const { adminView } = useAdminMode();
  const [phase, setPhase] = useState("choose");
  const [prefs, setPrefs] = useState(loadPrefs);
  const [tracks, setTracks] = useState(null);
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [source, setSource] = useState("");

  const update = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const min = Number(params.get("min"));
    if (TIMES.includes(min)) update({ min });
    setSource((params.get("src") || "").slice(0, 100));
    base44.entities.SilenceSoundtrack.filter({ aktywny: true }, { sort: "kolejnosc", limit: 200 })
      .then((p) => setTracks(p.items))
      .catch(() => setTracks([]));
    base44.entities.SilenceSettings.filter({}, { limit: 1 })
      .then((p) => p.items[0] && setSettings({ ...SETTINGS_DEFAULTS, ...p.items[0] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = TIMES.includes(prefs.min) ? prefs.min : 10;
  const list = (tracks || []).filter((t) => t.czas_min === minutes);
  const bgId = resolveBg(list, prefs.bg?.[minutes]);
  const setBg = (id) => update({ bg: { ...(prefs.bg || {}), [minutes]: id } });
  const volume = typeof prefs.vol === "number" ? prefs.vol : settings.glosnosc_domyslna;
  const muted = typeof prefs.muted === "boolean" ? prefs.muted : settings.dzwiek_domyslnie === "wyciszony";

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {adminView && phase === "choose" && (
        <Link to="/admin/cisza" className="fixed top-12 right-4 z-50 technical text-[10px] gold-text hover:text-[#E2C170]">
          Zarządzaj dźwiękami
        </Link>
      )}
      {phase === "choose" && (
        <CiszaChoose
          minutes={minutes} setMinutes={(m) => update({ min: m })} tracks={tracks}
          bgId={bgId} onBg={setBg} onStart={() => setPhase("session")} reduced={reduced}
        />
      )}
      {phase === "session" && (
        <CiszaSession
          minutes={minutes} tracks={list} bgId={bgId} onBg={setBg}
          volume={volume} onVolume={(v) => update({ vol: v })} muted={muted} onMuted={(m) => update({ muted: m })}
          settings={settings} source={source} reduced={reduced}
          onDone={() => setPhase("end")} onExit={() => setPhase("choose")}
        />
      )}
      {phase === "end" && <CiszaEnd text={settings.tekst_na_koniec} onAgain={() => setPhase("choose")} reduced={reduced} />}
    </div>
  );
}