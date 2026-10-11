import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SessionRow from "./SessionRow";
import ChangeSession from "./ChangeSession";
import PackageBooker from "@/components/booking/PackageBooker";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);

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

  if (err) return <p className="blood-text text-sm">{err}</p>;
  if (!d) return <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />;

  const now = Date.now();
  const upcoming = d.bookings.filter((b) => b.status === "POTWIERDZONA" && new Date(b.ends_at).getTime() >= now);
  const history = d.bookings.filter((b) => !(b.status === "POTWIERDZONA" && new Date(b.ends_at).getTime() >= now));

  return (
    <div className="space-y-14">
      <section>
        <p className="technical text-[10px] gold-text mb-6">PAKIETY</p>
        {d.packages.length === 0 ? (
          <p className="text-sm text-foreground/50">Nie masz jeszcze pakietu sesji.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {d.packages.map((p) => (
              <div key={p.id} className="border hairline p-5 space-y-3">
                <p className="relic-heading text-lg gold-text">{p.type}</p>
                <p className="text-sm text-foreground/70">Wykorzystane: {p.sessions_used} / {p.sessions_total} · zostało {p.sessions_left}</p>
                <p className="text-xs text-foreground/50">
                  Ważny do {new Date(p.valid_until).toLocaleDateString("pl-PL")}
                  {p.min_gap_days ? ` · odstęp min. ${p.min_gap_days} dni` : ""}
                </p>
                {p.sessions_left > 0 && new Date(p.valid_until).getTime() > now && (
                  <button onClick={() => setBookFrom(p)} className="btn-relic text-[10px]">ZAREZERWUJ TERMIN</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="technical text-[10px] gold-text mb-6">NAJBLIŻSZE</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground/50">Brak zaplanowanych spotkań.</p>
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
          <p className="text-sm text-foreground/50">Jeszcze pusto.</p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => <SessionRow key={b.id} b={b} past />)}
          </div>
        )}
      </section>

      {bookFrom && (
        <div className="border border-[#C9A24A] p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="relic-heading text-xl">Wybierz termin — {bookFrom.type}</p>
            <button onClick={() => setBookFrom(null)} className="technical text-[10px] text-foreground/50">ZAMKNIJ</button>
          </div>
          <PackageBooker
            packageId={bookFrom.id}
            purchasedAt={bookFrom.purchased_at}
            consent={d.consent}
            onDone={() => { setBookFrom(null); load(); }}
          />
        </div>
      )}

      {reschedule && (
        <ChangeSession b={reschedule} onClose={() => setReschedule(null)} onChanged={() => { setReschedule(null); load(); }} />
      )}
    </div>
  );
}