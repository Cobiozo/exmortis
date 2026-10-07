import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CiszaChoose from "@/components/exmortis/cisza/CiszaChoose";
import CiszaSession from "@/components/exmortis/cisza/CiszaSession";
import CiszaEnd from "@/components/exmortis/cisza/CiszaEnd";
import { useReducedMotion } from "@/components/exmortis/cisza/motion";
import { TIMES, SETTINGS_DEFAULTS, loadPrefs, savePrefs } from "@/components/exmortis/cisza/prefs";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { available, pickSignal } from "@/components/exmortis/cisza/library";
import { isView, DEFAULT_VIEW } from "@/components/exmortis/cisza/views";
import Backdrop from "@/components/exmortis/cisza/backdrop/Backdrop";
import { BLACK, orderBackdrops, resolveBackdrop } from "@/components/exmortis/cisza/backdrop/backdrops";

// Minutnik ciszy — tylko czas, prosty widok i znak exmortis.
export default function Cisza() {
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { adminView, isAdmin } = useAdminMode();
  const [phase, setPhase] = useState("choose");
  const [prefs, setPrefs] = useState(() => { const { track, ...p } = loadPrefs(); return p; }); // eslint-disable-line no-unused-vars
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [tracks, setTracks] = useState([]);
  const [source, setSource] = useState("");
  const [backdrops, setBackdrops] = useState([BLACK]);
  const [signals, setSignals] = useState([]);

  const update = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const min = Number(params.get("min"));
    if (TIMES.includes(min)) update({ min });
    setSource((params.get("src") || "").slice(0, 100));
    savePrefs({ ...prefs }); // usuwa zapamiętany utwór
    base44.entities.SilenceSignal.filter({ aktywny: true }, { limit: 50 }).then((p) => setSignals(p.items)).catch(() => {});
    base44.entities.SilenceBackground.filter({ aktywne: true }, { sort: "kolejnosc", limit: 100 }).then((p) => setBackdrops(orderBackdrops(p.items))).catch(() => {});
    base44.entities.SilenceSettings.filter({}, { limit: 1 }).then((p) => {
      const s = { ...SETTINGS_DEFAULTS, ...(p.items[0] || {}) };
      setSettings(s);
      // Muzyka tylko, gdy admin ją włączył — inaczej utwory nie są nawet pobierane.
      if (s.muzyka_wlaczona) base44.entities.SilenceTrack.filter({ aktywny: true }, { sort: "kolejnosc", limit: 200 }).then((r) => setTracks(r.items)).catch(() => {});
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = TIMES.includes(prefs.min) ? prefs.min : 10;
  const list = available(tracks, minutes);
  const music = settings.muzyka_wlaczona ? list.find((t) => t.domyslny) || list[0] || null : null;
  const intro = pickSignal(signals, "wstep");
  const outro = pickSignal(signals, "zakonczenie", prefs.outro);
  const volume = typeof prefs.vol === "number" ? prefs.vol : settings.glosnosc_domyslna;
  const muted = typeof prefs.muted === "boolean" ? prefs.muted : settings.dzwiek_domyslnie === "wyciszony";
  const view = isView(prefs.view) ? prefs.view : isView(settings.widok_domyslny) ? settings.widok_domyslny : DEFAULT_VIEW;
  const backdrop = resolveBackdrop(backdrops, prefs.backdrop);
  const common = { view, onView: (v) => update({ view: v }), backdrops, backdropId: backdrop.id, onBackdrop: (id) => update({ backdrop: id }) };
  const speedParam = Number(new URLSearchParams(window.location.search).get("speed"));
  const speed = isAdmin && speedParam > 1 ? Math.min(600, speedParam) : 1;
  const home = () => navigate("/");

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0B] overflow-hidden">
      <Backdrop bg={backdrop} reduced={reduced} fadeMs={phase === "session" ? 1500 : 800} zoomMs={phase === "session" ? (minutes * 60000) / speed : 0} />
      {adminView && phase === "choose" && (
        <Link to="/admin/cisza" className="fixed bottom-3 right-4 z-50 technical text-[10px] gold-text hover:text-[#E2C170]">Zarządzaj</Link>
      )}
      {phase === "choose" && (
        <CiszaChoose {...common} minutes={minutes} setMinutes={(m) => update({ min: m })} onStart={() => setPhase("session")} onLogo={home}
          minutesOnly={!!prefs.minutesOnly} onMinutesOnly={(v) => update({ minutesOnly: v })} introUrl={intro?.plik} />
      )}
      {phase === "session" && (
        <CiszaSession {...common} minutes={minutes} music={music} fadeMs={Number(settings.wyciszanie_melodii_s ?? 8) * 1000}
          volume={volume} onVolume={(v) => update({ vol: v })} muted={muted} onMuted={(m) => update({ muted: m })}
          source={source} reduced={reduced} minutesOnly={!!prefs.minutesOnly} speed={speed}
          onDone={() => setPhase("end")} onExit={() => setPhase("choose")} backdropName={backdrop.nazwa} intro={intro} outro={outro} />
      )}
      {phase === "end" && <CiszaEnd text={settings.tekst_na_koniec} onAgain={() => setPhase("choose")} onLogo={home} reduced={reduced} view={view} minutes={minutes} backdrop={backdrop} />}
    </div>
  );
}