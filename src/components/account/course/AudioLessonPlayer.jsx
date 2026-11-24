import React, { useEffect, useRef, useState } from "react";
import { Check, ArrowRight, Headphones } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AudioControls from "./AudioControls";

const SESSION = crypto.randomUUID();

// Nagranie audio w koncie: tylko odtwarzanie (bez pobierania), gra też przy zablokowanym ekranie
// (sterowanie z ekranu blokady przez Media Session), pamięta miejsce, jedno odtwarzanie naraz.
export default function AudioLessonPlayer({ accessId, courseName, lesson, onDone, onNext, nextTitle }) {
  const ref = useRef(null);
  const lastSave = useRef(0);
  const resumeAt = useRef(null);
  const retried = useRef(false);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem("exm_audio_speed")) || 1);
  const [done, setDone] = useState(lesson.completed);

  const call = (action, extra = {}) =>
    base44.functions.invoke("course", { action, access_id: accessId, lesson_id: lesson.id, session_id: SESSION, ...extra });
  const loadUrl = () => call("play").then((r) => setSrc(r.data?.url || ""))
    .catch((e) => setErr(e?.response?.data?.error || "Nagranie nie chce się wczytać. Spróbuj za chwilę."));
  const send = (extra = {}) => call("progress", { position_s: ref.current?.currentTime || 0, ...extra }).then((r) => {
    if (r.data?.stopped) { ref.current?.pause(); setErr("Słuchasz teraz na innym urządzeniu."); }
  }).catch(() => {});

  useEffect(() => { if (lesson.has_video) loadUrl(); }, [lesson.id]);
  useEffect(() => () => { if (ref.current?.currentTime > 0) send(); }, [lesson.id]);
  // Link wygasa po 60 min — odświeżamy co 50 min z zachowaniem miejsca.
  useEffect(() => {
    if (!src) return undefined;
    const t = setTimeout(() => { resumeAt.current = ref.current?.currentTime || 0; loadUrl(); }, 50 * 60000);
    return () => clearTimeout(t);
  }, [src]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed, src]);

  const toggle = () => { const a = ref.current; if (!a) return; a.paused ? a.play().catch(() => {}) : a.pause(); };
  const seek = (s) => { if (ref.current) ref.current.currentTime = Math.max(0, Math.min(s, ref.current.duration || s)); };
  const skip = (d) => seek((ref.current?.currentTime || 0) + d);

  // Ekran blokady i słuchawki: tytuł oraz przyciski odtwarzania i przewijania.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || !src) return undefined;
    ms.metadata = new window.MediaMetadata({ title: lesson.title, artist: "EXMORTIS", album: courseName || "", ...(lesson.cover ? { artwork: [{ src: lesson.cover, sizes: "512x512" }] } : {}) });
    const h = { play: () => ref.current?.play(), pause: () => ref.current?.pause(), seekbackward: () => skip(-15), seekforward: () => skip(30), seekto: (e) => seek(e.seekTime) };
    Object.entries(h).forEach(([k, fn]) => { try { ms.setActionHandler(k, fn); } catch { /* nieobsługiwane */ } });
    return () => Object.keys(h).forEach((k) => { try { ms.setActionHandler(k, null); } catch { /* */ } });
  }, [src, lesson.id]);

  const onTime = () => {
    const a = ref.current;
    setTime(a.currentTime);
    if (navigator.mediaSession?.setPositionState && a.duration) {
      try { navigator.mediaSession.setPositionState({ duration: a.duration, position: a.currentTime, playbackRate: a.playbackRate }); } catch { /* */ }
    }
    if (Date.now() - lastSave.current > 15000) { lastSave.current = Date.now(); send(); }
    if (!done && a.duration && a.currentTime / a.duration > 0.9) { setDone(true); onDone(lesson.id); send({ completed: true }); }
  };

  return (
    <div className="min-w-0">
      <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8" onContextMenu={(e) => e.preventDefault()}>
        <div className="mb-6 flex items-center gap-4">
          {lesson.cover
            ? <img src={lesson.cover} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-exm-line object-cover md:h-24 md:w-24" />
            : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-exm-gold-line text-exm-gold"><Headphones className="h-6 w-6" strokeWidth={1.25} /></span>}
          <div className="min-w-0">
            <p className="exm-eyebrow">Nagranie audio</p>
            <p className="mt-1 truncate text-[15px] text-exm-muted">{courseName}</p>
          </div>
        </div>
        {!lesson.has_video ? <p className="text-sm text-exm-muted">Nagranie jest przygotowywane.</p> : err ? (
          <div className="space-y-3">
            <p className="text-sm text-[#E8C547]">{err}</p>
            <button type="button" onClick={() => { setErr(""); setSrc(""); retried.current = false; loadUrl(); }} className="btn-ghost">{/innym urządzeniu/.test(err) ? "Słuchaj tutaj" : "Spróbuj ponownie"}</button>
          </div>
        ) : (
          <AudioControls playing={playing} loading={!src || loading} time={time} duration={duration} speed={speed}
            onToggle={toggle} onSeek={seek} onSkip={skip} onSpeed={(s) => { setSpeed(s); localStorage.setItem("exm_audio_speed", String(s)); }} />
        )}
        {src && (
          <audio ref={ref} src={src} preload="metadata"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 0);
              const at = resumeAt.current ?? (!lesson.completed ? lesson.position_s : 0);
              if (at) e.currentTarget.currentTime = at;
              if (resumeAt.current != null) { resumeAt.current = null; e.currentTarget.play().catch(() => {}); }
            }}
            onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); send(); }}
            onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onEnded={() => setPlaying(false)}
            onError={() => {
              if (!retried.current) { retried.current = true; resumeAt.current = ref.current?.currentTime || 0; loadUrl(); return; }
              setErr("Nagranie nie chce się wczytać. Sprawdź połączenie i spróbuj ponownie.");
            }} />
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap sm:gap-6">
        <h2 className="shop-heading text-2xl text-[#F5EFE1]">{lesson.title}</h2>
        {done ? <span className="technical flex shrink-0 items-center gap-1 text-[10px] gold-text"><Check className="h-4 w-4" /> WYSŁUCHANE</span> : (
          <button onClick={() => { setDone(true); onDone(lesson.id); send({ completed: true }); }} className="btn-ghost shrink-0 !px-4 !py-2 text-[10px]">Oznacz jako wysłuchane</button>
        )}
      </div>
      {onNext && (
        <button onClick={onNext} className={`mt-5 ${done ? "btn-relic" : "btn-ghost"} max-w-full !px-5 !py-3 text-[10px]`}>
          <span className="truncate">Dalej: {String(nextTitle || "")}</span> <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      )}
      {lesson.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/65">{lesson.description}</p>}
    </div>
  );
}