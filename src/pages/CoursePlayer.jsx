import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LessonList from "@/components/account/course/LessonList";
import LessonPlayer from "@/components/account/course/LessonPlayer";
import LicenseConsent from "@/components/account/course/LicenseConsent";
import { useAuth } from "@/lib/AuthContext";
import { useNoIndex } from "@/lib/useNoIndex";

export default function CoursePlayer() {
  const { accessId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [current, setCurrent] = useState(null);
  const { user } = useAuth();
  const [consented, setConsented] = useState(false);
  useEffect(() => { if (user?.license_consent_at) setConsented(true); }, [user]);
  useNoIndex();

  const load = () =>
    base44.functions.invoke("course", { action: "outline", access_id: accessId })
      .then((r) => {
        setData(r.data);
        setCurrent((c) => c || (r.data.lessons.find((l) => !l.completed) || r.data.lessons[0])?.id || null);
      })
      .catch(() => setErr("Nie masz dostępu do tego kursu albo dostęp wygasł."));
  useEffect(() => { load(); }, [accessId]);

  const markDone = (id) => setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === id ? { ...l, completed: true } : l)) }));

  if (err) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-5 text-center pt-28"><p className="text-foreground/60">{err}</p><Link to="/konto" className="btn-ghost">MOJE PRODUKTY</Link></div>;
  if (!data) return <div className="min-h-[60vh] flex items-center justify-center pt-28"><Loader2 className="h-6 w-6 animate-spin gold-text" /></div>;

  const idx = data.lessons.findIndex((l) => l.id === current);
  const lesson = data.lessons[idx];
  const next = idx >= 0 ? data.lessons[idx + 1] : null;
  const done = data.lessons.filter((l) => l.completed).length;
  const pct = data.lessons.length ? Math.round((done / data.lessons.length) * 100) : 0;
  const pick = (id) => { setCurrent(id); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="pt-28 pb-24 px-5 md:px-10 mx-auto max-w-[1300px]">
      <Link to="/konto" className="inline-flex items-center gap-2 technical text-[10px] text-foreground/55 hover:gold-text"><ArrowLeft className="h-4 w-4" /> MOJE PRODUKTY</Link>
      <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mt-6">{data.name}</h1>
      <div className="mt-4 max-w-md">
        <div className="flex justify-between technical text-[10px] text-foreground/55"><span>UKOŃCZONE {done} / {data.lessons.length}</span><span>{pct}%</span></div>
        <div className="mt-2 h-1 bg-[#26262A]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Postęp kursu">
          <div className="h-full bg-[#C9A24A] transition-all" style={{ width: `${pct}%` }} />
        </div>
        {data.valid_until && <p className="text-xs text-foreground/55 mt-2">Dostęp do {new Date(`${data.valid_until}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</p>}
      </div>
      {data.lessons.length === 0 ? (
        <p className="mt-10 text-foreground/55">Lekcje są przygotowywane. Dam znać mailem, kiedy będą gotowe.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10">
          {lesson && (consented ? <LessonPlayer key={lesson.id} accessId={accessId} lesson={lesson} onDone={markDone} onNext={next ? () => pick(next.id) : null} nextTitle={next?.title} /> : <LicenseConsent onAccept={() => setConsented(true)} />)}
          <LessonList lessons={data.lessons} current={current} onPick={pick} />
        </div>
      )}
    </div>
  );
}