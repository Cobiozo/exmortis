import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CiszaLogo from "@/components/exmortis/cisza/CiszaLogo";
import { base44 } from "@/api/base44Client";
import CiszaChoose from "@/components/exmortis/cisza/CiszaChoose";
import CiszaSession from "@/components/exmortis/cisza/CiszaSession";
import CiszaEnd from "@/components/exmortis/cisza/CiszaEnd";
import { useReducedMotion } from "@/components/exmortis/cisza/motion";
import { TIMES, SETTINGS_DEFAULTS, loadPrefs, savePrefs, resolveBg } from "@/components/exmortis/cisza/prefs";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { getView } from "@/components/exmortis/cisza/views";
import Backdrop from "@/components/exmortis/cisza/backdrop/Backdrop";
import { BLACK, orderBackdrops, resolveBackdrop, matchTrack } from "@/components/exmortis/cisza/backdrop/backdrops";

// Minutnik ciszy — osobna strona bez logowania.
export default function Cisza() {
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { adminView, isAdmin } = useAdminMode();
  const [phase, setPhase] = useState("choose");
  const [prefs, setPrefs] = useState(loadPrefs);
  const [tracks, setTracks] = useState(null);
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [source, setSource] = useState("");
  const [backdrops, setBackdrops] = useState([BLACK]);
  const [dimmed, setDimmed] = useState(false);

  const update = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const min = Number(params.get("min"));
    if (TIMES.includes(min)) update({ min });
    setSource((params.get("src") || "").slice(0, 100));
    base44.entities.SilenceSoundtrack.filter({ aktywny: true }, { sort: "kolejnosc", limit: 200 })
      .then((p) => setTracks(p.items))
      .catch(() => setTracks([]));
    base44.entities.SilenceBackground.filter({ aktywne: true }, { sort: "kolejnosc", limit: 100 })
      .then((p) => setBackdrops(orderBackdrops(p.items)))
      .catch(() => {});
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
  const view = getView(prefs.view).id;
  const backdrop = resolveBackdrop(backdrops, prefs.backdrop);
  const match = matchTrack(backdrop, list, bgId);
  const viewProps = {
    backdrops, backdropId: backdrop.id, onBackdrop: (id) => update({ backdrop: id }), match,
    view, onView: (v) => update({ view: v }),
    showTime: !!prefs.showTime, onShowTime: (v) => update({ showTime: v }),
    minutesOnly: !!prefs.minutesOnly, onMinutesOnly: (v) => update({ minutesOnly: v }),
  };
  // Tryb testowy ?speed=60 — działa tylko dla administratora.
  const speedParam = Number(new URLSearchParams(window.location.search).get("speed"));
  const speed = isAdmin && speedParam > 1 ? Math.min(600, speedParam) : 1;

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <Backdrop
        bg={backdrop} reduced={reduced} fadeMs={phase === "session" ? 1500 : 800}
        dim={phase === "session" && dimmed} zoomMs={phase === "session" ? (minutes * 60000) / speed : 0}
      />
      {phase !== "session" && (
        <div className="fixed inset-x-0 top-[max(20px,env(safe-area-inset-top))] sm:top-[30px] z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto"><CiszaLogo onClick={() => navigate("/")} /></div>
        </div>
      )}
      {adminView && phase === "choose" && (
        <Link to="/admin/cisza" className="fixed top-12 right-4 z-50 technical text-[10px] gold-text hover:text-[#E2C170]">
          Zarządzaj dźwiękami
        </Link>
      )}
      {phase === "choose" && (
        <CiszaChoose
          minutes={minutes} setMinutes={(m) => update({ min: m })} tracks={tracks}
          bgId={bgId} onBg={setBg} onStart={() => setPhase("session")} reduced={reduced} {...viewProps}
        />
      )}
      {phase === "session" && (
        <CiszaSession
          minutes={minutes} tracks={list} bgId={bgId} onBg={setBg}
          volume={volume} onVolume={(v) => update({ vol: v })} muted={muted} onMuted={(m) => update({ muted: m })}
          settings={settings} source={source} reduced={reduced}
          onDone={() => setPhase("end")} onExit={() => setPhase("choose")}
          {...viewProps} dim={!!prefs.dim} onDim={(v) => update({ dim: v })} speed={speed}
          onDimmed={setDimmed} backdropName={backdrop.nazwa}
        />
      )}
      {phase === "end" && <CiszaEnd text={settings.tekst_na_koniec} onAgain={() => setPhase("choose")} reduced={reduced} view={view} minutes={minutes} backdrop={backdrop} />}
    </div>
  );
}