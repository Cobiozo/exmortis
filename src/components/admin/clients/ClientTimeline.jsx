import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, Loader2, Mail, MessageSquare, Mic, Newspaper, ShoppingBag, Tag, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Karta klienta 360° (28.11.2026): suma zakupów, newsletter, notatka i tagi, oś czasu wszystkich zdarzeń osoby.
const zl = (n) => `${Number(n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;
const day = (d) => (d ? new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Warsaw" }) : "");
const ORDER = { COMPLETED: "opłacone", CANCELED: "anulowane", PENDING: "oczekuje", NEW: "oczekuje", FAILED: "nieudane", FREE: "darmowe" };
const SUB = { active: "zapisana/y", pending: "czeka na potwierdzenie", unsubscribed: "wypisana/y" };

export default function ClientTimeline({ email }) {
  const [d, setD] = useState(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState([]);
  const [tagIn, setTagIn] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    base44.functions.invoke("adminClients", { action: "timeline", email }).then((r) => {
      setD(r.data);
      setNote(r.data.note?.note || "");
      setTags(r.data.note?.tags || []);
    }).catch(() => setD(false));
  }, [email]);

  const save = async (nextTags = tags, nextNote = note) => {
    setSaved("Zapisuję…");
    try {
      await base44.functions.invoke("adminClients", { action: "note_save", email, note: nextNote, tags: nextTags });
      setSaved("Zapisano");
    } catch { setSaved("Nie udało się zapisać"); }
    setTimeout(() => setSaved(""), 2500);
  };
  const addTag = () => {
    const t = tagIn.trim();
    if (!t || tags.includes(t)) return setTagIn("");
    const next = [...tags, t];
    setTags(next); setTagIn(""); save(next);
  };
  const delTag = (t) => { const next = tags.filter((x) => x !== t); setTags(next); save(next); };

  const events = useMemo(() => {
    if (!d) return [];
    const ev = [];
    for (const o of d.orders || []) ev.push({ at: o.created_date || o.at, icon: ShoppingBag, title: `${o.items || "Zamówienie"}`, sub: `${zl(o.total)} · ${ORDER[o.status] || o.status}${o.code ? ` · kod ${o.code}` : ""}${o.test ? " · test" : ""}`, to: "/admin/zamowienia" });
    for (const r of d.registrations || []) ev.push({ at: r.at, icon: CalendarDays, title: `Zapis: ${r.title || "spotkanie"}`, sub: `${r.status || ""}${r.start_datetime ? ` · ${day(r.start_datetime)}` : ""}`, to: "/admin/spotkania" });
    for (const b of d.bookings || []) ev.push({ at: b.at, icon: CalendarDays, title: `Rezerwacja: ${b.name || "spotkanie"}`, sub: b.status || "", to: "/admin/rezerwacje" });
    for (const p of d.powrot || []) ev.push({ at: p.at, icon: FileText, title: "Zgłoszenie POWRÓT", sub: p.status || "", to: `/admin/powrot?email=${encodeURIComponent(email)}` });
    for (const p of d.prog || []) ev.push({ at: p.at, icon: FileText, title: "Rozmowa na progu", sub: p.status || "", to: "/admin/rozmowa" });
    for (const p of d.podcast || []) ev.push({ at: p.at, icon: Mic, title: "Zgłoszenie do podcastu", sub: p.status || "", to: "/admin/glos?widok=podcast&tab=zgloszenia" });
    for (const m of d.messages || []) ev.push({ at: m.at, icon: MessageSquare, title: "Wiadomość z formularza", sub: m.preview || "", to: "/admin/skrzynka" });
    return ev.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [d, email]);

  if (d === null) return <p className="flex items-center gap-2 text-sm text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Ładuję historię osoby…</p>;
  if (d === false) return <p className="text-sm text-foreground/50">Nie udało się wczytać historii osoby.</p>;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Wydane", zl(d.totals?.spent), `${d.totals?.orders || 0} opłac. zamówień`],
          ["Spotkania", String((d.registrations || []).length), "zapisy"],
          ["Newsletter", d.subscriber ? (SUB[d.subscriber.status] || d.subscriber.status) : "nie", d.subscriber ? `od ${day(d.subscriber.at)}` : ""],
          ["Zgłoszenia", String((d.powrot || []).length + (d.prog || []).length + (d.podcast || []).length), "POWRÓT, Rozmowa, podcast"],
        ].map(([k, v, s]) => (
          <div key={k} className="border hairline p-3">
            <p className="text-[11px] text-foreground/50">{k}</p>
            <p className="text-lg gold-text mt-1">{v}</p>
            {s && <p className="text-[11px] text-foreground/45">{s}</p>}
          </div>
        ))}
      </div>
      {d.test && <p className="text-xs text-foreground/50 border hairline px-3 py-2">To konto jest rozpoznane jako testowe — jego zamówienia nie wchodzą do statystyk.</p>}

      <div className="border hairline p-4 space-y-3">
        <p className="flex items-center justify-between text-xs text-foreground/60">
          <span className="inline-flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Notatka i tagi — widzisz tylko Ty</span>
          {saved && <span className="gold-text">{saved}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 border border-[#C9A24A]/50 gold-text px-2 py-0.5 text-xs">
              {t}<button type="button" onClick={() => delTag(t)} aria-label={`Usuń tag ${t}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="+ tag (Enter), np. VIP, mentoring" className="bg-transparent border hairline px-2 py-1 text-xs w-48 focus:border-[#C9A24A] focus:outline-none" />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (d.note?.note || "") && save(tags, note)} rows={3}
          placeholder="Np. poznaliśmy się na Wieczorze powrotu, chce mentoringu od stycznia"
          className="w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none" />
      </div>

      <div>
        <p className="technical text-[10px] gold-text mb-3">HISTORIA OSOBY</p>
        {!events.length ? <p className="text-sm text-foreground/50">Brak zdarzeń poza kontem.</p> : (
          <ol className="border-l hairline ml-2 space-y-3">
            {events.slice(0, 60).map((e, i) => (
              <li key={i} className="relative pl-5">
                <span className="absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#0A0A0B] border hairline"><e.icon className="h-2.5 w-2.5 gold-text" /></span>
                <Link to={e.to} className="block hover:bg-white/[0.02]">
                  <span className="block text-sm text-foreground/85 [overflow-wrap:anywhere]">{e.title}</span>
                  <span className="block text-xs text-foreground/45">{day(e.at)}{e.sub ? ` · ${e.sub}` : ""}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 flex flex-wrap gap-4 text-xs">
          <a href={`mailto:${email}`} className="inline-flex items-center gap-1 text-foreground/60 hover:gold-text"><Mail className="h-3.5 w-3.5" /> Napisz e-mail</a>
          <Link to={`/admin/dane-osoby?email=${encodeURIComponent(email)}`} className="inline-flex items-center gap-1 text-foreground/60 hover:gold-text"><Newspaper className="h-3.5 w-3.5" /> Dane osoby (RODO)</Link>
        </p>
      </div>
    </section>
  );
}
