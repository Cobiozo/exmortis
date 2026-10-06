import React, { useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Odtwarzacz lekcji: podpisany link, bez pobierania, znak wodny z e-mailem, zapis postępu.
export default function LessonPlayer({ accessId, lesson, onDone }) {
  const { user } = useAuth();
  const ref = useRef(null);
  const lastSave = useRef(0);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(lesson.completed);

  useEffect(() => {
    if (!lesson.has_video) return;
    base44.functions.invoke("course", { action: "play", access_id: accessId, lesson_id: lesson.id })
      .then((r) => setUrl(r.data.url))
      .catch((e) => setErr(e?.response?.data?.error || "Wideo nie chce się wczytać. Spróbuj za chwilę."));
  }, [lesson.id]);

  const send = (extra = {}) =>
    base44.functions.invoke("course", { action: "progress", access_id: accessId, lesson_id: lesson.id, position_s: ref.current?.currentTime || 0, ...extra });

  const onTime = () => {
    const v = ref.current;
    if (Date.now() - lastSave.current > 15000) { lastSave.current = Date.now(); send(); }
    if (!done && v.duration && v.currentTime / v.duration > 0.9) { setDone(true); onDone(lesson.id); send({ completed: true }); }
  };

  return (
    <div>
      <div className="relative aspect-video bg-black border hairline" onContextMenu={(e) => e.preventDefault()}>
        {!lesson.has_video ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-foreground/50">Wideo jest przygotowywane.</p>
        ) : err ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-[#E8C547] px-6 text-center">{err}</p>
        ) : !url ? (
          <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin gold-text" />
        ) : (
          <video ref={ref} src={url} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline className="w-full h-full"
            onLoadedMetadata={(e) => { if (lesson.position_s && !lesson.completed) e.currentTarget.currentTime = lesson.position_s; }}
            onTimeUpdate={onTime} onPause={() => send()} />
        )}
        {url && user?.email && <span className="pointer-events-none absolute top-3 right-4 text-[10px] text-white/25 select-none">{user.email}</span>}
      </div>
      <div className="mt-6 flex items-start justify-between gap-6">
        <h2 className="shop-heading text-2xl text-[#F5EFE1]">{lesson.title}</h2>
        {done ? <span className="technical text-[10px] gold-text flex items-center gap-1"><Check className="h-4 w-4" /> UKOŃCZONA</span> : (
          <button onClick={() => { setDone(true); onDone(lesson.id); send({ completed: true }); }} className="btn-ghost !px-4 !py-2 text-[10px] shrink-0">OZNACZ JAKO UKOŃCZONĄ</button>
        )}
      </div>
      {lesson.description && <p className="mt-4 text-foreground/65 leading-relaxed whitespace-pre-line">{lesson.description}</p>}
    </div>
  );
}