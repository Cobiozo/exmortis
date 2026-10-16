import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Play, X, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { plWhenFull, whenText } from "@/components/exmortis/events/time";
import RecordingPlayer, { leftText } from "./RecordingPlayer";
import MyTickets from "./MyTickets";

// Moje konto → Spotkania: nagrania (tylko zapisani, w oknie udostępnienia), nadchodzące spotkania z osobistym linkiem, historia.
export default function MyEvents() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState(null);
  const [, tick] = useState(0);
  const load = () => base44.functions.invoke("myEvents", { action: "list" })
    .then((r) => setItems(r.data.items || [])).catch(() => setErr("Nie udało się wczytać spotkań. Odśwież stronę."));
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  if (err) return <p className="text-sm text-[#E8C547]">{err}</p>;
  if (!items) return <Loader2 className="h-6 w-6 animate-spin gold-text" />;

  const now = Date.now();
  const recs = items.filter((i) => i.recording && new Date(i.recording.until).getTime() > now);
  const upcoming = items.filter((i) => !i.ended).reverse();
  const past = items.filter((i) => i.ended && !recs.includes(i));

  if (!items.length) return (
    <div className="border hairline p-6 md:p-8 max-w-2xl">
      <p className="text-foreground/75 leading-relaxed">Nie widzę tu zapisów na spotkania. Pokazuję zapisy na adres <strong className="text-[#F5EFE1]">{user?.email}</strong> — jeśli zapis był na inny adres, zaloguj się nim.</p>
      <Link to="/spotkania" className="btn-ghost mt-6">ZOBACZ SPOTKANIA <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );

  return (
    <div className="space-y-14">
      <MyTickets />
      {recs.length > 0 && (
        <section>
          <p className="technical text-[10px] gold-text mb-6">NAGRANIA · TYLKO DLA OSÓB ZAPISANYCH</p>
          <div className="space-y-6">
            {recs.map((i) => (
              <article key={i.id} className="border hairline p-5 md:p-6 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="shop-heading text-2xl text-[#F5EFE1]">{i.title}</h3>
                    <p className="text-sm text-foreground/55 mt-1">Spotkanie: {plWhenFull(i.start_datetime)}</p>
                    <p className="technical text-[10px] text-[#E8C547] mt-3">DOSTĘPNE JESZCZE {leftText(i.recording.until).toUpperCase()} · DO {whenText(i.recording.until).toUpperCase()}</p>
                  </div>
                  {playing === i.id ? (
                    <button onClick={() => setPlaying(null)} className="btn-ghost !px-4 !py-2 text-[10px] shrink-0"><X className="h-4 w-4" /> ZAMKNIJ</button>
                  ) : (
                    <button onClick={() => setPlaying(i.id)} className="btn-relic !px-5 !py-3 text-[10px] shrink-0"><Play className="h-4 w-4" /> OBEJRZYJ</button>
                  )}
                </div>
                {playing === i.id && (
                  <div className="mt-6">
                    <RecordingPlayer item={i} onExpired={load} />
                    <p className="text-xs text-foreground/55 mt-3 leading-relaxed">Nagranie jest tylko do obejrzenia tutaj — bez pobierania. Po {whenText(i.recording.until)} zniknie z konta.</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <p className="technical text-[10px] gold-text mb-6">NADCHODZĄCE</p>
          <div className="space-y-4">
            {upcoming.map((i) => (
              <div key={i.id} className="border hairline p-5 flex flex-wrap items-center justify-between gap-4 min-w-0">
                <div className="min-w-0">
                  <p className="text-[#F5EFE1]">{i.title}</p>
                  <p className="text-sm text-foreground/55 mt-1">{plWhenFull(i.start_datetime)} · {i.format === "Online" ? "online" : "na żywo"}</p>
                </div>
                {i.status === "Odwołane" ? <span className="technical text-[10px] text-foreground/55">ODWOŁANE</span>
                  : i.reg_status === "Lista rezerwowa" ? <span className="technical text-[10px] text-[#E8C547]">LISTA REZERWOWA</span>
                  : i.event_url || i.join_url ? <Link to={i.event_url || i.join_url} className="btn-ghost !px-4 !py-2 text-[10px]">STRONA SPOTKANIA <ArrowRight className="h-4 w-4" /></Link>
                  : <span className="technical text-[10px] text-foreground/55">ZAPISANO</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <p className="technical text-[10px] text-foreground/55 mb-6">MINIONE</p>
          <ul className="space-y-3">
            {past.map((i) => (
              <li key={i.id} className="text-sm text-foreground/55 flex flex-wrap gap-x-3">
                <span className="text-foreground/75">{i.title}</span>
                <span>{plWhenFull(i.start_datetime)}</span>
                {i.recording_was && <span className="text-foreground/55">· nagranie było dostępne przez ograniczony czas</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}