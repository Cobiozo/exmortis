import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CalendarPlus, Receipt, Gem, Settings, Signpost, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { listStories, cachedList } from "@/components/rozdroza/api";
import { readProgress } from "@/components/rozdroza/engine";
import ProductTile from "./ProductTile";
import NextStepCard from "./NextStepCard";

// Moje konto → Start (16.11.2026): najważniejsze rzeczy na jednym ekranie.
// Dane z tych samych funkcji co sekcje (myAccount → products, myEvents → list, Rozdroża → lista),
// postęp kursu z serwera (lessons_done / lessons_total), postęp Rozdroży z tej przeglądarki (jak w czytniku).
const TZ = "Europe/Warsaw";
const card = "rounded-2xl border hairline bg-[#111113]";
const h2 = "shop-heading text-2xl text-[#F5EFE1] leading-tight";
const Sk = ({ className = "" }) => <span className={`block rounded-md bg-white/[0.06] animate-pulse motion-reduce:animate-none ${className}`} />;
const btnGold = "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-[#C9A24A] text-[#0A0A0B] text-sm font-semibold hover:bg-[#E2C27A] transition-colors";
const btnLine = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg border border-white/15 text-sm text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors";

function DateBox({ iso }) {
  const d = new Date(iso);
  return (
    <span className="w-14 shrink-0 text-center rounded-xl border border-[#C9A24A]/40 py-1.5" aria-hidden="true">
      <span className="block shop-heading text-[26px] leading-none text-[#F5EFE1] tabular-nums">{d.toLocaleDateString("pl-PL", { day: "numeric", timeZone: TZ })}</span>
      <span className="block technical text-[9px] gold-text mt-1">{d.toLocaleDateString("pl-PL", { month: "short", timeZone: TZ }).replace(".", "").toUpperCase()}</span>
    </span>
  );
}

export default function StartPanel({ state, go }) {
  const { user } = useAuth();
  const uid = user?.id || user?.email;
  const [products, setProducts] = useState(undefined); // undefined = wczytuję, null = błąd
  const [next, setNext] = useState(null);
  const [events, setEvents] = useState(undefined);
  const [stories, setStories] = useState(() => cachedList());
  const rzOn = !!(state.rz || state.me?.role === "admin");

  useEffect(() => {
    base44.functions.invoke("myAccount", { action: "products" })
      .then((r) => { setProducts(r.data.products || []); setNext(r.data.next || null); })
      .catch(() => setProducts(null));
    base44.functions.invoke("myEvents", { action: "list" })
      .then((r) => setEvents(r.data.items || []))
      .catch(() => setEvents(null));
  }, []);
  useEffect(() => { if (rzOn) listStories().then(setStories).catch(() => {}); }, [rzOn]);

  // Najbliższe spotkanie: zapis aktywny, spotkanie nieodwołane i jeszcze się nie skończyło.
  const upcoming = (events || [])
    .filter((i) => !i.ended && i.status !== "Odwołane")
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  const ev = upcoming[0];

  // Kontynuuj: kurs w trakcie (najpierw rozpoczęty, potem nierozpoczęty).
  const courses = (products || []).filter((p) => p.active && p.lessons_total > 0 && p.lessons_done < p.lessons_total);
  const course = courses.find((p) => p.lessons_done > 0) || courses[0];
  const pct = course ? Math.round((course.lessons_done / course.lessons_total) * 100) : 0;

  // Rozdroża: ostatnio czytana, niedokończona historia z tej przeglądarki; inaczej pierwsza do odkrycia.
  const list = (stories || []).filter((s) => !s.scheduled_at);
  const withProg = uid ? list.map((s) => ({ s, p: readProgress(uid, s.id) })).filter((x) => x.p?.stack?.length && !x.p.done) : [];
  withProg.sort((a, b) => (b.p.at || 0) - (a.p.at || 0));
  const reading = withProg[0]?.s || null;
  const story = reading || list[0] || null;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        {/* Najbliższe spotkanie */}
        <section className={`${card} p-5 md:p-6 flex flex-col gap-4 min-w-0`} aria-labelledby="st-ev">
          <div className="flex items-center justify-between gap-3">
            <h2 id="st-ev" className={h2}>Najbliższe spotkanie</h2>
            <Link to="/konto?tab=spotkania" className="text-sm gold-text hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0">Wszystkie <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {events === undefined ? (
            <><div className="flex gap-4 items-center"><Sk className="h-14 w-14 rounded-xl" /><Sk className="h-4 w-1/2" /></div><Sk className="h-11 w-40" /></>
          ) : ev ? (
            <>
              <div className="flex gap-4 items-center min-w-0">
                <DateBox iso={ev.start_datetime} />
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[#F5EFE1] break-words">{ev.title}</p>
                  <p className="text-sm text-[#F5EFE1]/65 mt-0.5">
                    {new Date(ev.start_datetime).toLocaleString("pl-PL", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ })}
                    {" · "}{ev.format === "Online" ? "online" : "na żywo"}
                    {" · "}{ev.reg_status === "Lista rezerwowa" ? <span className="text-[#E8C547]">lista rezerwowa</span> : <span className="text-[#9FD0AA]">zapisano</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                {ev.join_url && <Link to={ev.join_url} className={btnGold}>Dołącz</Link>}
                {ev.event_url && <Link to={ev.event_url} className={btnLine}>Strona spotkania</Link>}
              </div>
              {ev.join_url && <p className="text-xs text-[#F5EFE1]/55">Przycisk „Dołącz” prowadzi do Twojego osobistego wejścia — tam też dodasz spotkanie do kalendarza.</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-[#F5EFE1]/70">{events === null ? "Nie udało się wczytać spotkań." : "Nie masz zapisów na nadchodzące spotkania."}</p>
              <div className="mt-auto"><Link to="/spotkania" className={btnLine}><CalendarDays className="h-4 w-4" /> Zobacz spotkania</Link></div>
            </>
          )}
        </section>

        {/* Kontynuuj */}
        <section className={`${card} p-5 md:p-6 flex flex-col gap-4 min-w-0`} aria-labelledby="st-co">
          <h2 id="st-co" className={h2}>Kontynuuj</h2>
          {products === undefined ? (
            <><Sk className="h-4 w-2/3" /><Sk className="h-1.5 w-full" /><Sk className="h-11 w-44" /></>
          ) : course ? (
            <>
              <div className="flex gap-4 items-center min-w-0">
                <span className="h-14 w-14 shrink-0 rounded-xl border hairline bg-[#0F0F10] flex items-center justify-center" aria-hidden="true"><Layers className="h-6 w-6 gold-text" strokeWidth={1.25} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#F5EFE1] break-words">{course.name}</p>
                  <p className="text-sm text-[#F5EFE1]/65 mt-0.5">Lekcja {Math.min(course.lessons_done + 1, course.lessons_total)} z {course.lessons_total} · {pct}%</p>
                  <div className="mt-2 h-1.5 rounded-full bg-[#26262A]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Postęp kursu">
                    <div className="h-full rounded-full bg-[#C9A24A]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-auto"><Link to={`/konto/kurs/${course.access_id}`} className={btnLine}>{course.lessons_done > 0 ? "Wróć do nauki" : "Zacznij kurs"} <ArrowRight className="h-4 w-4" /></Link></div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#F5EFE1]/70">Tu pojawi się kurs, który przerabiasz, razem z Twoim postępem.</p>
              <div className="mt-auto"><Link to="/skarbiec" className={btnLine}><Gem className="h-4 w-4" /> Zajrzyj do Skarbca</Link></div>
            </>
          )}
        </section>
      </div>

      {/* Rozdroża */}
      {rzOn && story && (
        <section aria-labelledby="st-rz" className="rounded-2xl border border-[#C9A24A]/35 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5"
          style={{ background: "radial-gradient(120% 140% at 100% 0%, rgba(201,162,74,.13), #111113 58%)" }}>
          <span className="hidden md:flex h-16 w-16 shrink-0 rounded-2xl border border-[#C9A24A]/45 items-center justify-center" aria-hidden="true"><Signpost className="h-7 w-7 gold-text" strokeWidth={1.25} /></span>
          <div className="min-w-0 flex-1">
            <p className="technical text-[10px] gold-text">ROZDROŻA · INTERAKTYWNE HISTORIE</p>
            <h2 id="st-rz" className={`${h2} mt-1 break-words`}>{story.title}</h2>
            <p className="text-sm text-[#F5EFE1]/70 mt-1">
              {reading ? "Twoje wybory prowadzą dalej — wróć tam, gdzie zatrzymała się Twoja historia." : "Historia, w której to Ty wybierasz drogę."}
              {list.length > 1 ? ` W bibliotece: ${list.length} historii.` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 shrink-0">
            <Link to={`/konto/rozdroza/${story.slug}${reading ? "/czytaj" : ""}`} className={btnGold}>{reading ? "Czytaj dalej" : "Zacznij czytać"}</Link>
            <Link to="/konto/rozdroza/biblioteka" className={btnLine}>Wszystkie historie</Link>
          </div>
        </section>
      )}

      {/* Moje produkty */}
      <section aria-labelledby="st-pr" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="st-pr" className="shop-heading text-[28px] text-[#F5EFE1]">Moje produkty</h2>
          {products?.length > 3 && <button type="button" onClick={() => go("produkty")} className="text-sm gold-text hover:underline underline-offset-4 inline-flex items-center gap-1">Wszystkie ({products.length}) <ArrowRight className="h-3.5 w-3.5" /></button>}
        </div>
        {products === undefined ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <div key={i} className={`${card} overflow-hidden`}><Sk className="aspect-[4/3] rounded-none" /><div className="p-5 space-y-2"><Sk className="h-4 w-3/4" /><Sk className="h-3 w-1/2" /></div></div>)}</div>
        ) : products === null ? (
          <p className="text-sm text-[#F5EFE1]/70">Nie udało się wczytać produktów. <button type="button" onClick={() => go("produkty")} className="gold-text underline underline-offset-4">Otwórz sekcję Moje produkty</button></p>
        ) : products.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{products.slice(0, 3).map((p) => <ProductTile key={p.access_id} p={p} />)}</div>
        ) : (
          <div className={`${card} p-6`}>
            <p className="shop-heading text-xl text-[#F5EFE1]">Nie masz jeszcze żadnych produktów.</p>
            <p className="text-sm text-[#F5EFE1]/70 mt-1 max-w-[52ch]">W Skarbcu znajdziesz materiały na każdy etap drogi — także bezpłatne.</p>
            <Link to="/skarbiec" className={`${btnLine} mt-4`}><Gem className="h-4 w-4" /> Zajrzyj do Skarbca</Link>
          </div>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <NextStepCard step={next} />
        <section className={`${card} p-5 md:p-6`} aria-labelledby="st-qa">
          <h2 id="st-qa" className={h2}>Szybkie akcje</h2>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              ["sesje", "Umów spotkanie 1:1", "Wolne terminy", CalendarPlus],
              ["zakupy", "Zakupy i faktury", "Historia zamówień", Receipt],
              [null, "Skarbiec", "Materiały na drogę", Gem, "/skarbiec"],
              ["ustawienia", "Ustawienia konta", "Dane, hasło, zgody", Settings],
            ].map(([k, t, sub, Icon, href]) => (
              <Link key={t} to={href || `/konto?tab=${k}`} className="flex items-start gap-3 rounded-xl border border-white/10 p-3 min-h-[64px] hover:border-[#C9A24A]/60 transition-colors">
                <Icon className="h-4 w-4 gold-text mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0"><span className="block text-sm font-medium text-[#F5EFE1]">{t}</span><span className="block text-xs text-[#F5EFE1]/55">{sub}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
