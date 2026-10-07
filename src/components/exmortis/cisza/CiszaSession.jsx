import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SilenceAudio } from "./audioEngine";
import CiszaControls from "./CiszaControls";
import Stage from "./Stage";
import useWakeLock from "./useWakeLock";
import { nextView } from "./views";
import useScreenReaderMinutes from "./useScreenReaderMinutes";
import { useNavigate } from "react-router-dom";
import CiszaLogo from "./CiszaLogo";
import LeaveConfirm from "./LeaveConfirm";
import useStageSize from "./useStageSize";

const TIME_RESERVE = 64;

// Przebieg: wstęp → odliczanie z melodią → zakończenie. Jedno źródło czasu z Date.now().
export default function CiszaSession({
  minutes, tracks, bgId, onBg, volume, onVolume, muted, onMuted, settings, source, reduced, onDone, onExit,
  view, onView, showTime, onShowTime, dim, onDim, minutesOnly, speed = 1,
  backdrops, backdropId, onBackdrop, match, onDimmed, backdropName,
}) {
  const dur = (minutes * 60000) / speed;
  const fadeMs = Math.max(0, Number(settings.wyciszanie_melodii_s ?? 3) * 1000);
  const findT = (id) => tracks.find((t) => t.id === id) || null;
  const base = useRef(findT(bgId) || tracks.find((t) => t.domyslny) || tracks[0] || null).current;

  const [stage, setStage] = useState("intro");
  const [paused, setPaused] = useState(false);
  const [audioErr, setAudioErr] = useState(false);
  const [visible, setVisible] = useState(true);
  const [wake, setWake] = useState(true);
  const [full, setFull] = useState(false);
  const [peek, setPeek] = useState(false);
  const [lit, setLit] = useState(false);
  const [ask, setAsk] = useState(false);
  const navigate = useNavigate();
  // Rezerwa pod sceną na czas: 16 px odstępu + 28 px napisu + 20 px do paska.
  const [midRef, stageSize] = useStageSize(TIME_RESERVE + 32);
  useWakeLock(wake);

  const eng = useRef(null);
  const st = useRef({ stage: "intro", endAt: 0, pausedAt: 0, paused: false, faded: false, bg: findT(bgId), sid: null });
  const go = (s) => { st.current.stage = s; setStage(s); };

  // Wspólny zegar dla wszystkich widoków.
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

  const finish = (late) => {
    go("outro");
    if (muted || !tracks.length) navigator.vibrate?.(200);
    const outro = st.current.bg?.plik_zakonczenie || base?.plik_zakonczenie;
    const done = () => {
      if (st.current.sid) base44.functions.invoke("silenceSession", { event: "cisza_ukonczona", duration_minutes: minutes, session_id: st.current.sid }).catch(() => {});
      eng.current.stopAll(0);
      onDone();
    };
    if (outro && !late) eng.current.playOnce(outro).then(done);
    else setTimeout(done, late ? 0 : 4000);
  };

  useEffect(() => {
    const e = new SilenceAudio({ volume: volume / 100, muted, onError: () => setAudioErr(true) });
    eng.current = e;
    base44.functions
      .invoke("silenceSession", { event: "cisza_start", duration_minutes: minutes, soundtrack: st.current.bg?.nazwa || null, with_sound: tracks.length > 0 && !muted, source, background: backdropName })
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
      if (!s.faded && r <= fadeMs) {
        s.faded = true;
        e.stopMelody(Math.max(0, Math.min(fadeMs, r)));
      }
      if (r <= 0) finish(r < -20000);
    }, 100);
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
    const elapsed = ((dur - (s.paused ? s.endAt - s.pausedAt : s.endAt - Date.now())) * speed) / 1000;
    if (t?.plik_melodia) eng.current.switchMelody(t.plik_melodia, t.zapetlaj_melodie !== false, elapsed, 2000);
    else eng.current.stopMelody(2000);
  };

  const end = () => { eng.current.stopAll(2000); onExit(); };

  // Dotknięcie sceny: pokaż czas na 3 s; przy przygaszeniu — pełna jasność na 5 s.
  const timers = useRef({});
  const tapStage = () => {
    if (!showTime) { setPeek(true); clearTimeout(timers.current.p); timers.current.p = setTimeout(() => setPeek(false), 3000); }
  };
  const wakeUp = () => {
    if (!dim) return;
    setLit(true); clearTimeout(timers.current.l); timers.current.l = setTimeout(() => setLit(false), 5000);
  };

  // Pasek chowa się po 4 s; klawisze: spacja, M, V, T, D, F.
  const keys = useRef();
  keys.current = { muted, view, showTime, dim };
  useEffect(() => {
    let t;
    const show = () => { setVisible(true); clearTimeout(t); t = setTimeout(() => setVisible(false), 4000); };
    const key = (e) => {
      const k = keys.current;
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      else if (e.key === "m" || e.key === "M") onMuted(!k.muted);
      else if (e.key === "v" || e.key === "V") onView(nextView(k.view));
      else if (e.key === "t" || e.key === "T") onShowTime(!k.showTime);
      else if (e.key === "d" || e.key === "D") onDim(!k.dim);
      else if (e.key === "f" || e.key === "F") setFull((f) => !f);
      show();
    };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", show); window.removeEventListener("touchstart", show); window.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dimmed = dim && !lit;
  const slow = reduced ? true : dimmed ? 1000 : 0;
  useEffect(() => { onDimmed?.(dimmed); }, [dimmed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDimmed?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const bare = full || dimmed;
  return (
    <section
      onPointerDown={wakeUp}
      className="fixed inset-0 grid transition-[filter] duration-1000"
      style={{
        filter: dimmed ? "brightness(0.35)" : "none",
        gridTemplateRows: bare ? "8px 1fr 24px" : "calc(56px + env(safe-area-inset-top)) 1fr calc(76px + env(safe-area-inset-bottom))",
        height: "100dvh",
      }}
    >
      {/* GÓRA: logo */}
      <div className="relative flex justify-center items-end pt-[env(safe-area-inset-top)]">
        <div className="relative">
          <CiszaLogo hidden={bare} opacity={visible ? 0.6 : 0.25} slow={!visible} onClick={() => setAsk(true)} />
          {ask && <LeaveConfirm onStay={() => setAsk(false)} onLeave={() => { eng.current.stopAll(800); navigate("/"); }} />}
        </div>
      </div>
      {/* ŚRODEK: scena + czas pod nią */}
      <div ref={midRef} className="relative min-h-0 flex flex-col items-center justify-center">
        <p className="h-6 mb-2 text-sm text-foreground/45 transition-opacity duration-700" style={{ opacity: full ? 0 : 1 }}>
          {stage === "intro" ? "Za chwilę…" : paused ? "Pauza" : ""}
        </p>
        <div className={stage === "intro" && !reduced ? "fade-up" : ""} style={{ paddingBottom: TIME_RESERVE }}>
          {stageSize > 0 && (
            <Stage
              view={view} clock={clock} slow={slow} ending={stage === "outro"} minutesOnly={minutesOnly} size={stageSize}
              showTime={view !== "cyfry" && (showTime || peek)} onTap={tapStage} label={srText}
            />
          )}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{srText}</span>
      {/* DÓŁ: zarezerwowana strefa paska sterowania */}
      <div className="relative">
      {audioErr && !full && <p className="absolute -top-5 inset-x-0 text-center text-xs text-foreground/40">Nie udało się wczytać dźwięku — minutnik działa w ciszy</p>}
      <CiszaControls
        visible={visible} reduced={reduced} hasSound={tracks.length > 0} muted={muted} onMute={() => onMuted(!muted)}
        volume={volume} onVolume={onVolume} tracks={tracks} bgId={bgId} onBg={changeBg}
        paused={paused} onPause={togglePause} canPause={stage === "run"} onEnd={end} wake={wake} onWake={() => setWake((w) => !w)}
        view={view} onView={onView} showTime={showTime} onShowTime={() => onShowTime(!showTime)}
        dim={dim} onDim={() => onDim(!dim)} full={full} onFull={() => setFull((f) => !f)}
        backdrops={backdrops} backdropId={backdropId} onBackdrop={onBackdrop} match={match} onMatch={() => match && changeBg(match.id)}
      />
      </div>
    </section>
  );
}