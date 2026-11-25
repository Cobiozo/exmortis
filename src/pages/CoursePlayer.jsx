import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, BookOpen, Download, Headphones, Film } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LessonList from "@/components/account/course/LessonList";
import LessonPlayer from "@/components/account/course/LessonPlayer";
import AudioLessonPlayer from "@/components/account/course/AudioLessonPlayer";
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
  const [params, setParams] = useSearchParams();
  const mode = params.get("tryb") === "audio" || params.get("tryb") === "wideo" ? params.get("tryb") : "";
  const [dl, setDl] = useState(false);
  // Komunikat licencji tylko przy pierwszym otwarciu: zgoda z konta albo zapamiętana na tym urządzeniu.
  useEffect(() => {
    let local = false;
    try { local = !!localStorage.getItem("exm_license_ok"); } catch { /* bez pamięci */ }
    if (user?.license_consent_at || local) setConsented(true);
  }, [user]);
  const acceptLicense = () => { try { localStorage.setItem("exm_license_ok", new Date().toISOString()); } catch { /* bez pamięci */ } setConsented(true); };
  useNoIndex();

  const load = () => {
    setErr("");
    return base44.functions.invoke("course", { action: "outline", access_id: accessId })
      .then((r) => {
        setData(r.data);
        const m = new URLSearchParams(window.location.search).get("tryb");
        const pool = r.data.lessons.filter((l) => !m || l.kind === m);
        const list = pool.length ? pool : r.data.lessons;
        setCurrent((c) => c || (list.find((l) => !l.completed) || list[0])?.id || null);
      })
      .catch((e) => {
        const status = e?.response?.status || e?.status || 0;
        setErr(status === 403 || status === 401
          ? "Nie masz dostępu do tego kursu albo dostęp wygasł."
          : "Nie udało się wczytać kursu. Sprawdź połączenie i spróbuj ponownie.");
      });
  };
  useEffect(() => { load(); }, [accessId]);

  const markDone = (id) => setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === id ? { ...l, completed: true } : l)) }));

  if (err) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-5 text-center pt-28">
      <p className="text-foreground/60">{err}</p>
      <div className="flex flex-wrap justify-center gap-4">
        {/Nie udało się/.test(err) && <button onClick={load} className="btn-relic !px-5 !py-3 text-[10px]">Spróbuj ponownie</button>}
        <Link to="/konto" className="btn-ghost">Moje produkty</Link>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-[60vh] flex items-center justify-center pt-28"><Loader2 className="h-6 w-6 animate-spin gold-text" /></div>;

  const idx = data.lessons.findIndex((l) => l.id === current);
  const lesson = data.lessons[idx];
  const next = idx >= 0 ? data.lessons[idx + 1] : null;
  const done = data.lessons.filter((l) => l.completed).length;
  const pct = data.lessons.length ? Math.round((done / data.lessons.length) * 100) : 0;
  const pick = (id) => { setCurrent(id); window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Zestaw: przełącznik „Słuchaj / Oglądaj” (gdy są oba rodzaje nagrań) i e-book pod ręką.
  const kinds = { audio: data.lessons.filter((l) => l.kind === "audio").length, wideo: data.lessons.filter((l) => l.kind !== "audio").length };
  const both = kinds.audio > 0 && kinds.wideo > 0;
  const shown = both && mode ? data.lessons.filter((l) => (mode === "audio" ? l.kind === "audio" : l.kind !== "audio")) : data.lessons;
  const setMode = (m) => {
    const p = new URLSearchParams(params);
    if (m) p.set("tryb", m); else p.delete("tryb");
    setParams(p, { replace: true });
    const first = data.lessons.filter((l) => !m || (m === "audio" ? l.kind === "audio" : l.kind !== "audio"));
    if (m && !first.some((l) => l.id === current)) setCurrent((first.find((l) => !l.completed) || first[0])?.id || current);
  };
  const ebook = data.type === "zestaw" && data.has_file;
  const toReader = () => { try { sessionStorage.setItem("exm-reader-back", JSON.stringify({ id: accessId, to: `/konto/kurs/${accessId}${mode ? `?tryb=${mode}` : ""}`, label: "WRÓĆ DO NAGRAŃ" })); } catch { /* bez powrotu */ } };
  const downloadEbook = async () => {
    setDl(true);
    try {
      const r = await base44.functions.invoke("myAccount", { action: "file", access_id: accessId });
      const a = document.createElement("a");
      a.href = r.data.download_url || r.data.url; a.download = r.data.name || "ebook.pdf"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    } catch { /* przycisk wraca do stanu wyjściowego */ } finally { setDl(false); }
  };
  const nextIdx = shown.findIndex((l) => l.id === current);
  const nextShown = nextIdx >= 0 ? shown[nextIdx + 1] : next;

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
      {(ebook || both) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {ebook && <Link to={`/konto/czytaj/${accessId}`} onClick={toReader} className="btn-relic !px-4 !py-2.5"><BookOpen className="h-4 w-4" strokeWidth={1.25} /> Czytaj e-book</Link>}
          {ebook && <button onClick={downloadEbook} disabled={dl} className="btn-ghost !px-4 !py-2.5">{dl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.25} />} Pobierz PDF</button>}
          {both && (
            <div className="flex border hairline ml-0 sm:ml-auto" role="group" aria-label="Rodzaj nagrań">
              {[["", "Wszystko", null], ["audio", `Słuchaj (${kinds.audio})`, Headphones], ["wideo", `Oglądaj (${kinds.wideo})`, Film]].map(([m, label, Ico]) => (
                <button key={m || "all"} onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-3 py-2 text-xs inline-flex items-center gap-1.5 ${mode === m ? "bg-[#C9A24A] text-[#0B0B0C]" : "text-foreground/70 hover:gold-text"}`}>
                  {Ico && <Ico className="h-3.5 w-3.5" strokeWidth={1.5} />}{label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {data.lessons.length === 0 ? (
        <p className="mt-10 text-foreground/55">Lekcje są w przygotowaniu. Poinformuję Cię e-mailem, gdy będą dostępne.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10">
          {lesson && (!consented ? <LicenseConsent onAccept={acceptLicense} /> : lesson.kind === "audio"
            ? <AudioLessonPlayer key={lesson.id} accessId={accessId} courseName={data.name} lesson={lesson} onDone={markDone} onNext={nextShown ? () => pick(nextShown.id) : null} nextTitle={nextShown?.title} />
            : <LessonPlayer key={lesson.id} accessId={accessId} lesson={lesson} onDone={markDone} onNext={nextShown ? () => pick(nextShown.id) : null} nextTitle={nextShown?.title} />)}
          <LessonList lessons={shown} current={current} onPick={pick} />
        </div>
      )}
    </div>
  );
}