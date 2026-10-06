import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LessonList from "@/components/account/course/LessonList";
import LessonPlayer from "@/components/account/course/LessonPlayer";

export default function CoursePlayer() {
  const { accessId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [current, setCurrent] = useState(null);

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

  const lesson = data.lessons.find((l) => l.id === current);
  const done = data.lessons.filter((l) => l.completed).length;

  return (
    <div className="pt-28 pb-24 px-5 md:px-10 mx-auto max-w-[1300px]">
      <Link to="/konto" className="inline-flex items-center gap-2 technical text-[10px] text-foreground/50 hover:gold-text"><ArrowLeft className="h-4 w-4" /> MOJE PRODUKTY</Link>
      <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mt-6">{data.name}</h1>
      <p className="technical text-[10px] text-foreground/40 mt-2">UKOŃCZONE {done} / {data.lessons.length}</p>
      {data.lessons.length === 0 ? (
        <p className="mt-10 text-foreground/50">Lekcje są przygotowywane. Dam znać mailem, kiedy będą gotowe.</p>
      ) : (
        <div className="mt-10 grid lg:grid-cols-[1fr_340px] gap-10">
          {lesson && <LessonPlayer key={lesson.id} accessId={accessId} lesson={lesson} onDone={markDone} />}
          <LessonList lessons={data.lessons} current={current} onPick={setCurrent} />
        </div>
      )}
    </div>
  );
}