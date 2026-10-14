import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { listStories, cachedList, loadStory, CATEGORY_LABEL } from "./api";
import { readProgress, clearProgress } from "./engine";
import RzImage from "./RzImage";
import RzProblem from "./RzProblem";
import { linkPhones } from "@/lib/phones";

// Karta historii przed czytaniem. Tekst historii pobiera się w tle, żeby czytnik otworzył się od razu.
export default function RzPreview() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const uid = user?.id || user?.email;
  const find = (l) => (l || []).find((s) => s.slug === slug) || null;
  const [meta, setMeta] = useState(() => find(cachedList()));
  const [err, setErr] = useState("");
  const load = () => {
    setErr("");
    listStories().then((l) => { const m = find(l); if (m) setMeta(m); else setErr("Ta historia nie jest dostępna."); }).catch((e) => { if (!meta) setErr(e.message); });
  };
  useEffect(load, [slug]);
  useEffect(() => { loadStory(slug).catch(() => {}); }, [slug]);

  if (err) return <RzProblem text={err} onRetry={load} />;
  if (!meta) return <div className="max-w-[720px] mx-auto aspect-video bg-[#141416] animate-pulse motion-reduce:animate-none" aria-busy="true" />;
  const p = uid ? readProgress(uid, meta.id) : null;
  const going = p?.stack?.length > 1 && !p.done;

  return (
    <StoryCard meta={meta} going={going} backTo="/konto/rozdroza/biblioteka" backLabel="BIBLIOTEKA"
      onStart={() => nav(`/konto/rozdroza/${slug}/czytaj`)}
      onRestart={going ? () => { clearProgress(uid, meta.id); nav(`/konto/rozdroza/${slug}/czytaj`); } : null} />
  );
}

// Karta historii (to samo dla klienta i dla podglądu szkicu w panelu): okładka, opis, czas, ostrzeżenie, start.
export function StoryCard({ meta, going = false, backTo, backLabel, onStart, onRestart = null, note = null }) {
  return (
    <article className="max-w-[720px] mx-auto">
      <Link to={backTo} className="technical text-[10px] text-foreground/55 hover:text-foreground inline-flex items-center gap-2 mb-6"><ArrowLeft className="h-3.5 w-3.5" /> {backLabel}</Link>
      {note}
      {(meta.cover_landscape_url || meta.cover_portrait_url) && (
        <RzImage url={meta.cover_landscape_url || meta.cover_portrait_url} alt="" eager className="border hairline" />
      )}
      <div className="mt-8">
        <p className="technical text-[10px] text-[#E8676A]/90">{(CATEGORY_LABEL[meta.category] || "ROZDROŻA").toUpperCase()}</p>
        <h1 className="shop-heading text-4xl md:text-5xl text-[#F5EFE1] mt-2 leading-tight">{meta.title}</h1>
        {meta.reading_time || meta.estimated_minutes ? <p className="text-sm text-foreground/55 mt-3 flex items-center gap-1.5"><Clock className="h-4 w-4" /> Orientacyjnie {meta.reading_time || `${meta.estimated_minutes} min`} czytania jednej ścieżki</p> : null}
        {meta.summary && <p className="mt-6 text-[17px] text-foreground/80 leading-[1.8] whitespace-pre-line">{meta.summary}</p>}
        {meta.content_warning && (
          <div className="mt-6 border border-[#BC1E22]/50 bg-[#BC1E22]/[0.06] p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-[#E8676A] shrink-0 mt-0.5" />
            <div><p className="technical text-[10px] text-[#E8676A]">TRUDNE TREŚCI</p><p className="text-sm text-foreground/80 mt-1.5 leading-relaxed whitespace-pre-line">{meta.content_warning}</p>
              <p className="text-xs text-foreground/60 mt-3 leading-relaxed [&_a]:underline" dangerouslySetInnerHTML={{ __html: linkPhones("To fikcja literacka, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · w zagrożeniu życia 112.") }} /></div>
          </div>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onStart} className="btn-relic focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60">{going ? "KONTYNUUJ" : "ROZPOCZNIJ HISTORIĘ"}</button>
          {going && onRestart && (
            <button type="button" onClick={onRestart} className="technical text-[10px] text-foreground/55 hover:text-foreground underline underline-offset-4 min-h-[44px] px-2">OD POCZĄTKU</button>
          )}
        </div>
      </div>
    </article>
  );
}
