import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SilenceAudio } from "./audioEngine";
import CiszaControls from "./CiszaControls";
import CiszaFrame from "./CiszaFrame";
import TimerView from "./views/TimerView";
import LeaveConfirm from "./LeaveConfirm";
import useWakeLock from "./useWakeLock";
import useScreenReaderMinutes from "./useScreenReaderMinutes";
import { CISZA_LOGO } from "./CiszaLogo";
import { toPlay, offsetFor, dbGain } from "./library";

// Przebieg: sygnał wstępu → odliczanie w ciszy → sygnał zakończenia. Jedno źródło czasu z Date.now().
export default function CiszaSession({
  minutes, music, fadeMs = 8000, volume, onVolume, muted, onMuted, source, reduced, onDone, onExit,
  view, onView, minutesOnly, speed = 1, backdrops, backdropId, onBackdrop, backdropName, intro, outro,
}) {
  const dur = (minutes * 60000) / speed;
  const [stage, setStage] = useState("intro");
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [full, setFull] = useState(false);
  const [ask, setAsk] = useState(false);
  const navigate = useNavigate();
  useWakeLock(true);

  const eng = useRef(null);
  const st = useRef({ stage: "intro", endAt: 0, pausedAt: 0, paused: false, faded: false, sid: null, starting: null });
  const go = (s) => { st.current.stage = s; setStage(s); };
  const api = useRef({});

  const clock = useMemo(() => ({
    get: () => {
      const s = st.current;
      if (s.stage === "intro") return { p: 0, rem: minutes * 60000, paused: false };
      if (s.stage !== "run") return { p: 1, rem: 0, paused: false };
      const left = Math.max(0, s.paused ? s.endAt - s.pausedAt : s.endAt - Date.now());
      return { p: 1 - left / dur, rem: left * speed, paused: s.paused };
    },
  }), [dur, minutes, speed]);
  const srText = useScreenReaderMinutes(clock);

  // Media Session tylko na czas sygnałów.
  const meta = (on) => {
    const ms = navigator.mediaSession;
    if (!ms || !window.MediaMetadata) return;
    ms.metadata = on ? new window.MediaMetadata({ title: `Cisza · ${minutes} min`, artist: "exmortis", artwork: [{ src: CISZA_LOGO, sizes: "1024x1024", type: "image/png" }] }) : null;
  };
  const signal = (s) => { meta(true); return eng.current.playOnce(s.plik, dbGain(s.korekta_db)).catch(() => {}).finally(() => meta(false)); };

  const finish = (late) => {
    go("outro");
    if (muted) navigator.vibrate?.(200);
    eng.current.stopMelody(300);
    // Zapis ukończenia od razu po zliczeniu do zera — nie po sygnale końca.
    // Gdy potwierdzenie startu wciąż idzie, czekamy na nie; gdy się nie udało, jednorazowa próba po 3 s.
    const record = async () => {
      try {
        let sid = st.current.sid;
        if (!sid && st.current.starting) sid = (await st.current.starting)?.data?.session_id;
        if (sid) {
          st.current.sid = sid;
          const send = () => base44.functions.invoke("silenceSession", { event: "cisza_ukonczona", duration_minutes: minutes, session_id: sid });
          try { await send(); } catch { setTimeout(() => send().catch(() => {}), 3000); }
        }
      } catch { /* zapis nie może zatrzymać przebiegu sesji */ }
    };
    record();
    const done = () => { eng.current.stopAll(0); onDone(); };
    if (outro?.plik && !late) signal(outro).then(done);
    else setTimeout(done, late ? 0 : 4000);
  };

  useEffect(() => {
    const e = new SilenceAudio({ volume: volume / 100, muted, onInterrupt: () => { if (!st.current.paused) api.current.toggle(); } });
    eng.current = e;
    // Niesłyszalny ton podtrzymuje dźwięk przy zablokowanym ekranie, by sygnał końca zagrał na czas.
    let keep = null;
    if (e.ctx) {
      try {
        keep = e.ctx.createOscillator();
        const g = e.ctx.createGain(); g.gain.value = 0.0001;
        keep.connect(g).connect(e.ctx.destination); keep.start();
      } catch { keep = null; }
    }
    // Zapamiętana obietnica startu: przy błędzie jednorazowa ponowna próba — bez niej ukończenie nie miało dokąd trafić.
    st.current.starting = base44.functions
      .invoke("silenceSession", { event: "cisza_start", duration_minutes: minutes, soundtrack: music?.nazwa || null, with_sound: !muted, source, background: backdropName })
      .catch(() => base44.functions.invoke("silenceSession", { event: "cisza_start", duration_minutes: minutes, soundtrack: music?.nazwa || null, with_sound: !muted, source, background: backdropName }))
      .then((r) => { const sid = r?.data?.session_id; if (sid) st.current.sid = sid; return r; })
      .catch(() => {});
    const run = () => {
      if (st.current.stage !== "intro") return;
      st.current.endAt = Date.now() + dur;
      go("run");
      if (music?.plik) e.startMelody(toPlay(music, [music]), offsetFor(music, 0), 3000);
    };
    if (intro?.plik) { signal(intro).then(run); setTimeout(run, 20000); } else setTimeout(run, 1500);
    const id = setInterval(() => {
      const s = st.current;
      if (s.stage !== "run" || s.paused) return;
      const r = s.endAt - Date.now();
      if (music && !s.faded && r * speed <= fadeMs) { s.faded = true; e.stopMelody(Math.max(0, r)); }
      if (r <= 0) finish(r < -20000);
    }, 100);
    return () => { clearInterval(id); try { keep?.stop(); } catch { /* */ } e.stopAll(0); };
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
  api.current.toggle = togglePause;

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  // Pasek chowa się po 4 s bez ruchu; spacja = pauza, M = wycisz, F = pełny ekran.
  const keys = useRef(); keys.current = { muted };
  useEffect(() => {
    let t;
    const show = () => { setVisible(true); clearTimeout(t); t = setTimeout(() => setVisible(false), 4000); };
    const key = (e) => {
      if (e.code === "Space") { e.preventDefault(); api.current.toggle(); }
      else if (e.key === "m" || e.key === "M") onMuted(!keys.current.muted);
      else if (e.key === "f" || e.key === "F") toggleFull();
      show();
    };
    show();
    window.addEventListener("pointermove", show);
    window.addEventListener("touchstart", show);
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); window.removeEventListener("pointermove", show); window.removeEventListener("touchstart", show); window.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = () => { eng.current.stopAll(800); if (document.fullscreenElement) document.exitFullscreen?.(); onExit(); };

  return (
    <CiszaFrame
      onLogo={() => setAsk(true)}
      logoExtra={ask && <LeaveConfirm onStay={() => setAsk(false)} onLeave={() => { eng.current.stopAll(800); navigate("/"); }} />}
      bottom={
        <CiszaControls visible={visible} muted={muted} onMute={() => onMuted(!muted)} volume={volume} onVolume={onVolume}
          view={view} onView={onView} backdrops={backdrops} backdropId={backdropId} onBackdrop={onBackdrop}
          paused={paused} onPause={togglePause} canPause={stage === "run"} onEnd={end} full={full} onFull={toggleFull} />
      }
    >
      <p className="h-5 mb-3 text-sm text-foreground/55">{stage === "intro" ? "Za chwilę…" : paused ? "Pauza" : ""}</p>
      <TimerView clock={clock} view={view} minutesOnly={minutesOnly} ending={stage === "outro"} reduced={reduced} label={srText} />
      <span className="sr-only" aria-live="polite">{srText}</span>
      <p className="h-5 mt-3" aria-hidden="true" />
    </CiszaFrame>
  );
}