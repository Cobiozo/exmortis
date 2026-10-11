import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import NotFoundContent from "@/components/exmortis/NotFoundContent";
import PackageBooker from "@/components/booking/PackageBooker";
import { fullLabel, plNote } from "@/components/booking/bookingTime";

// Link z zamówienia: token tylko we fragmencie adresu (nie trafia do logów ani Referer),
// jednorazowy, ważny 60 dni. Odczyt → czyszczenie adresu → wybór terminu.
export default function RezerwacjaTermin() {
  const [p, setP] = useState(undefined);
  const [token, setToken] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer"; meta.content = "no-referrer";
    document.head.appendChild(meta);
    const t = new URLSearchParams(window.location.hash.slice(1)).get("t") || "";
    setToken(t);
    window.history.replaceState(null, "", window.location.pathname);
    base44.functions.invoke("bookingPublic", { action: "order", token: t })
      .then((r) => setP(r.data.package))
      .catch(() => setP(null));
    return () => meta.remove();
  }, []);

  if (p === undefined) return <div className="min-h-[60svh] pt-32 flex justify-center"><div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;
  if (!p) return <NotFoundContent />;

  return (
    <div className="pt-32 pb-24 container-exm">
      <div className="max-w-2xl">
        <p className="technical text-[10px] gold-text mb-3">WYBÓR TERMINU · {p.duration_min} MIN</p>
        <h1 className="relic-heading text-4xl mb-4">{p.type}</h1>
        <p className="text-foreground/60 mb-10">
          Sesji w pakiecie: {p.sessions_left} · ważny do {new Date(p.valid_until).toLocaleDateString("pl-PL")}
        </p>
        {done ? (
          <div className="border border-[#C9A24A] p-6 space-y-3" role="status">
            <p className="relic-heading text-2xl">Zarezerwowane</p>
            <p>{fullLabel(done.starts_at)}{plNote(done.starts_at) && <span className="text-foreground/50"> ({plNote(done.starts_at)})</span>}</p>
            <p className="text-sm text-foreground/70">Szczegóły i link Zoom pojawią się w Moich sesjach na koncie — zaloguj się adresem, na który kupiłaś/eś pakiet.</p>
          </div>
        ) : (
          <PackageBooker
            token={token}
            purchasedAt={p.purchased_at}
            consent={{ version: p.consent_version, text: p.consent_text }}
            onDone={setDone}
          />
        )}
      </div>
    </div>
  );
}