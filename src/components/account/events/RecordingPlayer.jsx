import React, { useEffect, useRef, useState } from "react";
import { Loader2, Maximize, Minimize } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Watermark from "@/components/account/course/Watermark";
import { watermarkOk } from "@/components/account/course/watermarkGuard";

// Pozostały czas udostępnienia: „23 godz. 5 min”, „12 min”.
export function leftText(until, now = Date.now()) {
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return "";
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} godz. ${m % 60} min` : `${m} min`;
}

// Odtwarzacz nagrania spotkania: krótko ważny link (odświeżany), bez pobierania, znak wodny z e-mailem,
// sam się zamyka, gdy minie czas udostępnienia.
export default function RecordingPlayer({ item, onExpired }) {
  const { user } = useAuth();
  const ref = useRef(null);
  const box = useRef(null);
  const resumeAt = useRef(null);
  const retried = useRef(false);
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState("");
  const [full, setFull] = useState(false);
  const [stamp] = useState(() => new Date().toLocaleString("pl-PL"));

  const call = (action) => base44.functions.invoke("myEvents", { action, event_id: item.id });
  const load = () => call("play").then((r) => { setSrc(r.data); retried.current = false; })
    .catch((e) => setErr(e?.response?.data?.error || "Nagranie nie chce się wczytać. Spróbuj za chwilę."));
  useEffect(() => { load(); }, [item.id]);

  // Podpisany link odświeżamy przed wygaśnięciem, z zachowaniem miejsca w nagraniu.
  useEffect(() => {
    if (!src?.expires_in) return;
    const t = setTimeout(() => { resumeAt.current = ref.current?.currentTime || 0; load(); }, Math.max(60, src.expires_in - 120) * 1000);
    return () => clearTimeout(t);
  }, [src]);

  // Koniec okna udostępnienia → zatrzymanie i schowanie odtwarzacza.
  useEffect(() => {
    const until = new Date(item.recording.until).getTime();
    const check = () => { if (Date.now() >= until) { ref.current?.pause(); setSrc(null); setErr("Czas udostępnienia nagrania minął."); onExpired?.(); } };
    const t = setInterval(check, 30000);
    check();
    return () => clearInterval(t);
  }, [item.recording.until]);

  // Znak wodny musi być widoczny — inaczej pauza i zgłoszenie.
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
  const fakeFull = full && !document.fullscreenElement;

  return (
    <div ref={box} className={`relative bg-black border hairline overflow-hidden ${fakeFull ? "fixed inset-0 z-[100]" : full ? "" : "aspect-video"}`} onContextMenu={(e) => e.preventDefault()}>
      {err ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-[#E8C547]">{err}</p>
          {!/minął|wstrzyman/i.test(err) && <button onClick={() => { setErr(""); setSrc(null); load(); }} className="btn-ghost !px-4 !py-2 text-[10px]">SPRÓBUJ PONOWNIE</button>}
        </div>
      ) : !src ? (
        <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin gold-text" />
      ) : src.embed ? (
        <iframe src={src.embed} title={item.title} className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <video ref={ref} src={src.url} controls controlsList="nodownload nofullscreen noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" className="w-full h-full"
          onLoadedMetadata={(e) => { if (resumeAt.current != null) { e.currentTarget.currentTime = resumeAt.current; resumeAt.current = null; e.currentTarget.play().catch(() => {}); } }}
          onError={() => {
            if (!retried.current) { retried.current = true; resumeAt.current = ref.current?.currentTime || 0; load(); return; }
            setErr("Nagranie nie chce się wczytać. Sprawdź połączenie i spróbuj ponownie.");
          }} />
      )}
      {src && !err && <Watermark text={`${user?.email || ""} · ${src.license} · ${stamp}`} />}
      {src && !err && !src.embed && (
        <button onClick={toggleFull} aria-label={full ? "Zamknij pełny ekran" : "Pełny ekran"} className="absolute top-3 right-3 z-30 p-2 bg-black/50 text-white/80 hover:text-white">
          {full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
