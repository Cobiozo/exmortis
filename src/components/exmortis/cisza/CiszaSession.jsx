import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SilenceAudio } from "./audioEngine";
import { clock } from "./prefs";
import CiszaControls from "./CiszaControls";
import useWakeLock from "./useWakeLock";

// Przebieg: wstęp → odliczanie z melodią → zakończenie. Zegar liczony z Date.now().
export default function CiszaSession({
  minutes, tracks, bgId, onBg, volume, onVolume, muted, onMuted, settings, source, reduced, onDone, onExit,
}) {
  const dur = minutes * 60000;
  const fadeMs = Math.max(0, Number(settings.wyciszanie_melodii_s ?? 3) * 1000);
  const findT = (id) => tracks.find((t) => t.id === id) || null;
  const base = useRef(findT(bgId) || tracks.find((t) => t.domyslny) || tracks[0] || null).current;

  const [stage, setStage] = useState("intro");
  const [rem, setRem] = useState(dur);
  const [paused, setPaused] = useState(false);
  const [audioErr, setAudioErr] = useState(false);
  const [visible, setVisible] = useState(true);
  const [wake, setWake] = useState(true);
  useWakeLock(wake);

  const eng = useRef(null);
  const st = useRef({ stage: "intro", endAt: 0, pausedAt: 0, paused: false, faded: false, bg: findT(bgId), sid: null });
  const go = (s) => { st.current.stage = s; setStage(s); };

  const finish = (late) => {
    go("outro");
    setRem(0);
    if (muted || !tracks.length) navigator.vibrate?.(200);
    const outro = st.current.bg?.plik_zakonczenie || base?.plik_zakonczenie;
    const done = () => {
      if (st.current.sid) base44.functions.invoke("silenceSession", { event: "cisza_ukonczona", duration_minutes: minutes, session_id: st.current.sid }).catch(() => {});
      eng.current.stopAll(0);
      onDone();
    };
    if (outro && !late) eng.current.playOnce(outro).then(done); else done();
  };

  useEffect(() => {
    const e = new SilenceAudio({ volume: volume / 100, muted, onError: () => setAudioErr(true) });
    eng.current = e;
    base44.functions
      .invoke("silenceSession", { event: "cisza_start", duration_minutes: minutes, soundtrack: st.current.bg?.nazwa || null, with_sound: tracks.length > 0 && !muted, source })
      .then((r) => (st.current.sid = r.data.session_id))
      .catch(() => {});
    const run = () => {
      if (st.current.stage !== "intro") return;
      st.current.endAt = Date.now() + dur;
      go("run");
      const b = st.current.bg;
      if (b?.plik_melodia) e.startMelody(b.plik_melodia, b.zapetlaj_melodie !== false, 0, fadeMs);
    };
    if (base?.plik_wstep) e.playOnce(base.plik_wstep).then(run); else run();

    const id = setInterval(() => {
      const s = st.current;
      if (s.stage !== "run" || s.paused) return;
      const r = s.endAt - Date.now();
      setRem(Math.max(0, r));
      if (!s.faded && r <= fadeMs) {
        s.faded = true;
        e.stopMelody(Math.max(0, Math.min(fadeMs, r)));
      }
      if (r <= 0) finish(r < -20000);
    }, 250);
    return () => { clearInterval(id); e.stopAll(0); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { eng.current?.setVolume(volume / 100); }, [volume]);
  useEffect(() => { eng.current?.setMuted(muted); }, [muted]);

  const togglePause = () => {
    const s = st.current;
    if (s.stage !== "run") return;
    if (!s.paused) { s.paused = true; s.pausedAt = Date.now(); eng.current.pauseAll(); setPaused(true); }
    else { s.endAt += Date.now() - s.pausedAt; s.paused = false; eng.current.resumeAll(); setPaused(false); }
  };

  const changeBg = (id) => {
    onBg(id);
    const t = findT(id);
    st.current.bg = t;
    const s = st.current;
    if (s.stage !== "run" || s.faded) return;
    const elapsed = (dur - (s.paused ? s.endAt - s.pausedAt : s.endAt - Date.now())) / 1000;
    if (t?.plik_melodia) eng.current.switchMelody(t.plik_melodia, t.zapetlaj_melodie !== false, elapsed, 2000);
    else eng.current.stopMelody(2000);
  };

  const end = () => { eng.current.stopAll(2000); onExit(); };

  // Pasek chowa się po 4 s; klawisze: spacja = pauza, M = wycisz.
  useEffect(() => {
    let t;
    const show = () => { setVisible(true); clearTimeout(t); t = setTimeout(() => setVisible(false), 4000); };
    const key = (e) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      else if (e.key === "m" || e.key === "M") onMuted(!muted);
      show();
    };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", show); window.removeEventListener("touchstart", show); window.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  return (
    <section className="fixed inset-0 bg-[#0A0A0B] flex flex-col items-center justify-center px-6">
      <p className="h-6 text-sm text-foreground/45">{stage === "intro" ? "Za chwilę…" : paused ? "Pauza" : ""}</p>
      <p className="shop-heading text-7xl md:text-9xl text-[#F5EFE1] tabular-nums mt-4" aria-live="off">{clock(rem)}</p>
      {audioErr && <p className="mt-8 text-xs text-foreground/40">Nie udało się wczytać dźwięku — minutnik działa w ciszy</p>}
      <CiszaControls
        visible={visible} reduced={reduced} hasSound={tracks.length > 0} muted={muted} onMute={() => onMuted(!muted)}
        volume={volume} onVolume={onVolume} tracks={tracks} bgId={bgId} onBg={changeBg}
        paused={paused} onPause={togglePause} canPause={stage === "run"} onEnd={end} wake={wake} onWake={() => setWake((w) => !w)}
      />
    </section>
  );
}