import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SessionRow from "./SessionRow";
import ChangeSession from "./ChangeSession";
import PackageBooker from "@/components/booking/PackageBooker";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);
const day = (v) => new Date(v).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

// Widzi każdy zalogowany. Bez przyznanego dostępu — jasna informacja i drogi dalej, bez kalendarza.
function NoAccess({ closed }) {
  return (
    <div className="border hairline p-6 md:p-8 space-y-5 max-w-[720px]">
      {closed ? (
        <>
          <p className="relic-heading text-xl md:text-2xl text-[#F5EFE1] break-words">Kalendarz jest jeszcze zamknięty</p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Masz dostęp do indywidualnych spotkań w programie POWRÓT. Terminy pojawią się tutaj, gdy kalendarz zostanie otwarty.
            Jeśli sprawa jest pilna, napisz do exmortis.
          </p>
        </>
      ) : (
        <>
          <p className="relic-heading text-xl md:text-2xl text-[#F5EFE1] break-words">Indywidualne spotkania są dla uczestników programu POWRÓT lub ROZMOWY NA PROGU.</p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Na tym koncie nie ma dostępu do umawiania spotkań — nie jesteś uczestnikiem programu POWRÓT albo dostęp nie został jeszcze włączony.
            Jeśli jesteś w programie, napisz do exmortis z adresu, na który założone jest to konto. Możesz też dołączyć do spotkań ogólnych.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Link to="/kontakt" className="btn-relic">NAPISZ DO EXMORTIS <ArrowRight className="h-4 w-4" /></Link>
        <Link to="/spotkania" className="btn-ghost">SPOTKANIA OGÓLNE</Link>
        <Link to="/skarbiec/rozmowa-na-progu" className="btn-ghost">ROZMOWA NA PROGU</Link>
        {!closed && <Link to="/powrot" className="btn-ghost">O PROGRAMIE POWRÓT</Link>}
      </div>
    </div>
  );
}

// MUSI 11: pakiety, najbliższa sesja, link Zoom od 15 min przed, Zarezerwuj / Przenieś / Anuluj, historia.
export default function MySessions() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [bookFrom, setBookFrom] = useState(null);
  const [reschedule, setReschedule] = useState(null);

  const load = useCallback(
    () => call({ action: "my_sessions" }).then(setD).catch((e) => setErr(e?.response?.data?.error || "Nie udało się wczytać sesji.")),
    []
  );
  useEffect(() => { load(); }, [load]);

  const head = (
    <div className="mb-10">
      <p className="technical text-[10px] gold-text mb-3">UMÓW INDYWIDUALNE SPOTKANIE</p>
      <p className="text-sm text-foreground/60 max-w-[640px]">Spotkanie 1:1 z exmortis w ramach programu POWRÓT — termin wybierasz z dostępnych godzin.</p>
      <p className="text-sm text-foreground/60 max-w-[640px] mt-2">Nie jesteś w programie POWRÓT? Możesz umówić pojedyncze spotkanie 1:1 — <Link to="/skarbiec/rozmowa-na-progu" className="gold-text underline underline-offset-4">Rozmowa na progu</Link>.</p>
    </div>
  );

  if (err) return <>{head}<p className="blood-text text-sm">{err}</p></>;
  if (!d) return <>{head}<div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></>;
  if (d.off) return <>{head}<NoAccess closed={!!d.has_access} /></>;

  const now = Date.now();
  const bookings = d.bookings || [];
  const packages = d.packages || [];
  const upcoming = bookings.filter((b) => b.status === "POTWIERDZONA" && new Date(b.ends_at).getTime() >= now);
  const history = bookings.filter((b) => !(b.status === "POTWIERDZONA" && new Date(b.ends_at).getTime() >= now));
  const hasAccess = packages.some((p) => p.sessions_left > 0);

  return (
    <div className="space-y-14">
      {head}
      {!hasAccess ? (
        <NoAccess />
      ) : (
        <section>
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((p) => {
              const next = p.next_possible && new Date(p.next_possible).getTime() > now ? p.next_possible : null;
              return (
                <div key={p.id} className="border hairline p-5 space-y-3">
                  <p className="relic-heading text-lg gold-text">{p.type}</p>
                  <p className="text-sm text-foreground/70">Zostało spotkań: {p.sessions_left} z {p.sessions_total}</p>
                  <p className="text-xs text-foreground/55">
                    Dostęp do {day(p.valid_until)}
                    {p.min_gap_days ? ` · spotkania nie częściej niż co ${p.min_gap_days} dni` : ""}
                  </p>
                  {next && p.sessions_left > 0 && (
                    <p className="text-xs text-foreground/60">Najbliższy możliwy termin: od {day(next)}</p>
                  )}
                  {p.sessions_left > 0 && new Date(p.valid_until).getTime() > now && (
                    <button onClick={() => setBookFrom(p)} className="btn-relic text-[10px]">UMÓW SPOTKANIE</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bookFrom && (
        <div className="border border-[#C9A24A] p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="relic-heading text-xl">Wybierz termin — {bookFrom.type}</p>
            <button onClick={() => setBookFrom(null)} className="technical text-[10px] text-foreground/55">ZAMKNIJ</button>
          </div>
          <PackageBooker
            packageId={bookFrom.id}
            purchasedAt={bookFrom.purchased_at}
            consent={d.consent}
            onDone={() => { setBookFrom(null); load(); }}
          />
        </div>
      )}

      {(hasAccess || bookings.length > 0) && (<>
      <section>
        <p className="technical text-[10px] gold-text mb-6">NAJBLIŻSZE</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground/55">Brak zaplanowanych spotkań.</p>
        ) : (
          <div className="space-y-4">
            {upcoming.map((b) => (
              <SessionRow key={b.id} b={b} onReschedule={() => setReschedule(b)} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="technical text-[10px] gold-text mb-6">HISTORIA</p>
        {history.length === 0 ? (
          <p className="text-sm text-foreground/55">Jeszcze pusto.</p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => <SessionRow key={b.id} b={b} past />)}
          </div>
        )}
      </section>
      </>)}

      {reschedule && (
        <ChangeSession b={reschedule} onClose={() => setReschedule(null)} onChanged={() => { setReschedule(null); load(); }} />
      )}
    </div>
  );
}