import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fullLabel, plNote } from "@/components/booking/bookingTime";

// Token tylko we fragmencie adresu (#t=…): nie trafia do logów serwera ani do Referer. Odczyt → czyszczenie adresu → POST.
export default function RezerwacjaZarzadzaj() {
  const [b, setB] = useState(undefined);
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer"; meta.content = "no-referrer";
    document.head.appendChild(meta);
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t") || "";
    window.history.replaceState(null, "", window.location.pathname);
    base44.functions.invoke("bookingPublic", { action: "manage", token }).then((r) => setB(r.data.booking)).catch(() => setB(null));
    return () => meta.remove();
  }, []);

  return (
    <div className="pt-32 pb-24 container-exm">
      <div className="max-w-xl">
        <p className="technical text-[10px] gold-text mb-3">TWOJA REZERWACJA</p>
        {b === undefined && <p className="text-foreground/50">Sprawdzam…</p>}
        {b === null && <p className="text-foreground/70">Ten link jest nieważny albo rezerwacja została anulowana.</p>}
        {b && (
          <div className="space-y-2">
            <h1 className="relic-heading text-3xl">{b.type}</h1>
            <p>{fullLabel(b.starts_at)}{plNote(b.starts_at) && <span className="text-foreground/50"> ({plNote(b.starts_at)})</span>}</p>
            <p className="text-sm text-foreground/60">Status: potwierdzona.</p>
          </div>
        )}
      </div>
    </div>
  );
}