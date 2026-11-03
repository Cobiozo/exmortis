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

// Odpowiedź listy: strona {items} albo tablica (zapas bazy aplikacji) — zawsze tablica, nigdy undefined.
const asList = (p) => (Array.isArray(p) ? p : Array.isArray(p?.items) ? p.items : []);

// Minutnik ciszy — tylko czas, prosty widok i znak exmortis.
// Działa bez konta: brak albo błąd konfiguracji = ustawienia domyślne (czarne tło, bez muzyki i sygnałów).
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
  // Stan konfiguracji: wczytywanie → gotowe / domyślne (brak ustawień) / błąd (minutnik działa w wersji podstawowej).
  const [config, setConfig] = useState("loading");

  const update = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const min = Number(params.get("min"));
    if (TIMES.includes(min)) update({ min });
    setSource((params.get("src") || "").slice(0, 100));
    savePrefs({ ...prefs }); // usuwa zapamiętany utwór
    base44.entities.SilenceSignal.filter({ aktywny: true }, { limit: 50 }).then((p) => setSignals(asList(p))).catch(() => {});
    base44.entities.SilenceBackground.filter({ aktywne: true }, { sort: "kolejnosc", limit: 100 })
      .then((p) => { const l = asList(p); if (l.length) setBackdrops(orderBackdrops(l)); }).catch(() => {});
    base44.entities.SilenceSettings.filter({}, { limit: 1 }).then((p) => {
      const row = asList(p)[0];
      const s = { ...SETTINGS_DEFAULTS, ...(row || {}) };
      setSettings(s);
      setConfig(row ? "ready" : "defaults");
      // Muzyka tylko, gdy admin ją włączył — inaczej utwory nie są nawet pobierane.
      if (s.muzyka_wlaczona) base44.entities.SilenceTrack.filter({ aktywny: true }, { sort: "kolejnosc", limit: 200 }).then((r) => setTracks(asList(r))).catch(() => {});
    }).catch(() => setConfig("error"));
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
      {/* Nagłówek strony dla wyszukiwarek i czytników ekranu — wygląd minutnika bez zmian. */}
      <h1 className="sr-only">Cisza — minutnik ciszy exmortis</h1>
      <Backdrop bg={backdrop} reduced={reduced} fadeMs={phase === "session" ? 1500 : 800} zoomMs={phase === "session" ? (minutes * 60000) / speed : 0} />
      {adminView && phase === "choose" && (
        <Link to="/admin/cisza" className="fixed bottom-3 right-4 z-50 technical text-[10px] gold-text hover:text-[#E2C170]">Zarządzaj</Link>
      )}
      {phase === "choose" && (
        <CiszaChoose {...common} minutes={minutes} setMinutes={(m) => update({ min: m })} onStart={() => setPhase("session")} onLogo={home}
          introUrl={intro?.plik} text={settings.tekst_wstep} />
      )}
      {phase === "session" && (
        <CiszaSession {...common} minutes={minutes} music={music} fadeMs={Number(settings.wyciszanie_melodii_s ?? 8) * 1000}
          volume={volume} onVolume={(v) => update({ vol: v })} muted={muted} onMuted={(m) => update({ muted: m })}
          source={source} reduced={reduced} speed={speed}
          onDone={() => setPhase("end")} onExit={() => setPhase("choose")} backdropName={backdrop.nazwa} intro={intro} outro={outro} />
      )}
      {phase === "choose" && config === "loading" && (
        <p role="status" className="fixed bottom-[calc(14px+env(safe-area-inset-bottom))] inset-x-0 z-20 text-center technical text-[10px] text-foreground/50 pointer-events-none">WCZYTUJĘ USTAWIENIA…</p>
      )}
      {phase === "choose" && config === "error" && (
        <p role="status" className="fixed bottom-[calc(14px+env(safe-area-inset-bottom))] inset-x-4 z-20 text-center text-xs text-foreground/60 pointer-events-none">Nie udało się wczytać ustawień — minutnik działa w wersji podstawowej.</p>
      )}
      {phase === "end" && <CiszaEnd text={settings.tekst_na_koniec} onAgain={() => setPhase("choose")} onLogo={home} reduced={reduced} view={view} minutes={minutes} backdrop={backdrop} />}
    </div>
  );
}