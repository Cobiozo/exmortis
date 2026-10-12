import React, { useEffect, useRef, useState } from "react";
import { Loader2, Check, Maximize, Minimize, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Watermark from "./Watermark";
import { watermarkOk } from "./watermarkGuard";

const SESSION = crypto.randomUUID();

// Odtwarzacz lekcji: link 60 min (odświeżany), znak wodny z kontrolą integralności, jedno odtwarzanie naraz.
export default function LessonPlayer({ accessId, lesson, onDone, onNext, nextTitle }) {
  const { user } = useAuth();
  const ref = useRef(null);
  const box = useRef(null);
  const lastSave = useRef(0);
  const resumeAt = useRef(null);
  const retried = useRef(false);
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(lesson.completed);
  const [full, setFull] = useState(false);
  const [stamp] = useState(() => new Date().toLocaleString("pl-PL"));

  const call = (action, extra = {}) =>
    base44.functions.invoke("course", { action, access_id: accessId, lesson_id: lesson.id, session_id: SESSION, ...extra });

  const loadUrl = () => call("play").then((r) => setSrc(r.data))
    .catch((e) => setErr(e?.response?.data?.error || "Wideo nie chce się wczytać. Spróbuj za chwilę."));

  useEffect(() => { if (lesson.has_video) loadUrl(); }, [lesson.id]);

  // Link wygasa po 60 min — odświeżamy co 50 min, zachowując pozycję.
  useEffect(() => {
    if (!src || src.embed || (src.server && !src.expires_in)) return; // zwykły link z serwera nie wygasa
    // Podpisany link (plik w aplikacji: 60 min, własny serwer: wg ustawień) — odświeżamy 10 min przed końcem.
    const ms = src.expires_in ? Math.max(5 * 60, src.expires_in - 10 * 60) * 1000 : 50 * 60000;
    const t = setTimeout(() => { resumeAt.current = ref.current?.currentTime || 0; loadUrl(); }, ms);
    return () => clearTimeout(t);
  }, [src]);

  // Kontrola znaku wodnego co 3 s.
  useEffect(() => {
    if (!src) return;
    const t = setInterval(() => {
      if (!watermarkOk(box.current) && ref.current && !ref.current.paused) {
        ref.current.pause();
        setErr("Odtwarzanie wstrzymane. Odśwież stronę.");
        call("violation");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [src]);

  useEffect(() => {
    const h = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFull = () => {
    if (box.current.requestFullscreen && !navigator.userAgent.match(/iPhone/)) {
      document.fullscreenElement ? document.exitFullscreen() : box.current.requestFullscreen();
    } else setFull((f) => !f);
  };

  const send = (extra = {}) =>
    call("progress", { position_s: ref.current?.currentTime || 0, ...extra }).then((r) => {
      if (r.data?.stopped) { ref.current?.pause(); setSrc(null); setErr("Oglądasz teraz na innym urządzeniu."); }
    });

  const onTime = () => {
    const v = ref.current;
    if (Date.now() - lastSave.current > 15000) { lastSave.current = Date.now(); send(); }
    if (!done && v.duration && v.currentTime / v.duration > 0.9) { setDone(true); onDone(lesson.id); send({ completed: true }); }
  };

  const fakeFull = full && !document.fullscreenElement;

  return (
    <div className="min-w-0">
      <div ref={box} className={`relative bg-black border hairline overflow-hidden ${fakeFull ? "fixed inset-0 z-[100]" : full ? "" : "aspect-video"}`} onContextMenu={(e) => e.preventDefault()}>
        {!lesson.has_video ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-foreground/50">Wideo jest przygotowywane.</p>
        ) : err ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-[#E8C547]">{err}</p>
            {!/innym urządzeniu|wstrzyman/i.test(err) && (
              <button onClick={() => { setErr(""); setSrc(null); retried.current = false; loadUrl(); }} className="btn-ghost !px-4 !py-2 text-[10px]">SPRÓBUJ PONOWNIE</button>
            )}
            {/innym urządzeniu/i.test(err) && (
              <button onClick={() => { setErr(""); setSrc(null); loadUrl(); }} className="btn-ghost !px-4 !py-2 text-[10px]">OGLĄDAJ TUTAJ</button>
            )}
          </div>
        ) : !src ? (
          <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin gold-text" />
        ) : src.embed ? (
          // Vimeo / YouTube / Bunny: odtwarzacz dostawcy; ukończenie oznaczasz przyciskiem pod filmem.
          <iframe src={src.embed} title={lesson.title} className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <video ref={ref} src={src.url} controls controlsList="nodownload nofullscreen noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback playsInline className="w-full h-full"
            onLoadedMetadata={(e) => {
              const at = resumeAt.current ?? (!lesson.completed ? lesson.position_s : 0);
              if (at) e.currentTarget.currentTime = at;
              if (resumeAt.current != null) { resumeAt.current = null; e.currentTarget.play().catch(() => {}); }
            }}
            onTimeUpdate={onTime} onPause={() => send()} preload="metadata"
            onError={() => {
              // Podpisany link mógł wygasnąć — jedna próba odświeżenia z zachowaniem pozycji; potem komunikat.
              if ((!src.server || src.expires_in) && !retried.current) { retried.current = true; resumeAt.current = ref.current?.currentTime || 0; loadUrl(); return; }
              setErr("Film nie chce się wczytać. Sprawdź połączenie i spróbuj ponownie.");
            }} />
        )}
        {src && !err && <Watermark text={`${user?.email || ""} · ${src.license} · ${stamp}`} />}
        {src && !err && !src.embed && (
          <button onClick={toggleFull} aria-label={full ? "Zamknij pełny ekran" : "Pełny ekran"} className="absolute top-3 right-3 z-30 p-2 bg-black/50 text-white/80 hover:text-white">
            {full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="mt-6 flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 sm:gap-6">
        <h2 className="shop-heading text-2xl text-[#F5EFE1]">{lesson.title}</h2>
        {done ? <span className="technical text-[10px] gold-text flex items-center gap-1 shrink-0"><Check className="h-4 w-4" /> UKOŃCZONA</span> : (
          <button onClick={() => { setDone(true); onDone(lesson.id); send({ completed: true }); }} className="btn-ghost !px-4 !py-2 text-[10px] shrink-0">OZNACZ JAKO UKOŃCZONĄ</button>
        )}
      </div>
      {onNext && (
        <button onClick={onNext} className={`mt-5 ${done ? "btn-relic" : "btn-ghost"} !px-5 !py-3 text-[10px] max-w-full`}>
          <span className="truncate">DALEJ: {String(nextTitle || "").toUpperCase()}</span> <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      )}
      {lesson.description && <p className="mt-4 text-foreground/65 leading-relaxed whitespace-pre-line">{lesson.description}</p>}
    </div>
  );
}