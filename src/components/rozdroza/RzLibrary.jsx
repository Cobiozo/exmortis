import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { listStories, cachedList, nextAt, plWhen, CATEGORY_LABEL } from "./api";
import { readProgress } from "./engine";
import RzImage from "./RzImage";
import RzProblem from "./RzProblem";

const FILTERS = [["", "Wszystkie"], ["mentalna", "Śmierć mentalna"], ["duchowa", "Śmierć duchowa"], ["zyciowa", "Śmierć życiowa"]];

// Biblioteka: same metadane opublikowanych historii (bez tekstów), filtr kategorii, postęp z tej przeglądarki.
export default function RzLibrary() {
  const { user } = useAuth();
  const uid = user?.id || user?.email;
  const [items, setItems] = useState(() => cachedList());
  const [err, setErr] = useState("");
  const [cat, setCat] = useState(() => { try { return sessionStorage.getItem("exm_rz_cat") || ""; } catch { return ""; } });
  const load = () => { setErr(""); listStories().then(setItems).catch((e) => { if (!cachedList()) setErr(e.message); }); };
  useEffect(load, []);
  const pick = (v) => { setCat(v); try { sessionStorage.setItem("exm_rz_cat", v); } catch { /* */ } };

  if (err) return <RzProblem text={err} onRetry={load} />;
  const shown = (items || []).filter((s) => !cat || s.category === cat);
  const cats = new Set((items || []).map((s) => s.category));
  const next = items ? nextAt() : null;
  const nextLine = next && <p className="text-sm text-foreground/55 mt-10 border-t hairline pt-6">Kolejna historia pojawi się {plWhen(next)}.</p>;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
        <div>
          <p className="technical text-[11px] gold-text">ROZDROŻA · BIBLIOTEKA</p>
          <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mt-3">Wybierz historię</h1>
        </div>
        {items && items.length > 1 && cats.size > 1 && (
          <div role="radiogroup" aria-label="Kategoria" className="flex flex-wrap gap-2">
            {FILTERS.filter(([v]) => !v || cats.has(v)).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={cat === v} onClick={() => pick(v)}
                className={`min-h-[40px] px-4 border technical text-[10px] focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60 ${cat === v ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60 hover:text-foreground"}`}>{l.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>
      {!items ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[2/3] bg-[#141416] animate-pulse motion-reduce:animate-none" />)}
        </div>
      ) : !items.length ? (
        <p className="border hairline p-8 text-foreground/65 max-w-xl">{next ? <>Pierwsza historia pojawi się tu {plWhen(next)}.</> : "Pierwsze historie pojawią się tu wkrótce."}</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
          {shown.map((s, i) => {
            const p = uid ? readProgress(uid, s.id) : null;
            const going = p?.stack?.length > 1 && !p.done;
            const ended = !!p?.ended?.length;
            return (
              <li key={s.id} className="min-w-0">
                <Link to={`/konto/rozdroza/${s.slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60">
                  <div className="relative">
                    <RzImage url={s.cover_portrait_url} alt="" ratio="aspect-[2/3]" eager={i < 2} sizes="(min-width: 1024px) 280px, (min-width: 768px) 30vw, 46vw" className="border hairline group-hover:border-[#C9A24A]/60 transition-colors" />
                    {ended && <span className="absolute top-2 left-2 technical text-[9px] bg-[#0A0A0B]/80 text-foreground/70 px-2 py-1 flex items-center gap-1"><Check className="h-3 w-3" /> UKOŃCZONO</span>}
                    {!ended && s.is_new && <span className="absolute top-2 left-2 technical text-[9px] bg-[#0A0A0B]/85 gold-text border border-[#C9A24A]/50 px-2 py-1">NOWA</span>}
                  </div>
                  {s.category && <p className="technical text-[9px] text-[#E8676A]/90 mt-3">{(CATEGORY_LABEL[s.category] || "").toUpperCase()}</p>}
                  <h2 className="shop-heading text-xl text-[#F5EFE1] mt-1 leading-tight group-hover:text-[#C9A24A]">{s.title}</h2>
                  {s.summary && <p className="text-sm text-foreground/60 mt-2 leading-relaxed line-clamp-3">{s.summary}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    {s.reading_time || s.estimated_minutes ? <span className="text-xs text-foreground/45 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.reading_time || `ok. ${s.estimated_minutes} min`}</span> : <span />}
                    <span className="technical text-[10px] gold-text">{going ? "KONTYNUUJ →" : "ROZPOCZNIJ →"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {items && items.length > 0 && nextLine}
    </div>
  );
}
