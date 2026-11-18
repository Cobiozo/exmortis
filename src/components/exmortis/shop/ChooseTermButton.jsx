import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight } from "lucide-react";

// MUSI 8/6: po opłaceniu zamówienia — jeśli na koncie czeka pakiet z wolną sesją,
// prowadzimy wprost do wyboru terminu. Gość dostaje link mailem.
export default function ChooseTermButton() {
  const [ready, setReady] = useState(false);
  // Pakiet powstaje przy realizacji zamówienia — sprawdzamy do 4 razy co 2,5 s, zanim przycisk się pojawi.
  useEffect(() => {
    let stop = false, tries = 0;
    const check = () => base44.functions.invoke("bookingPublic", { action: "my_sessions" })
      .then((r) => (r.data.packages || []).some((p) => p.sessions_left > 0))
      .catch(() => false)
      .then((ok) => {
        if (stop) return;
        if (ok) setReady(true);
        else if (++tries < 4) setTimeout(check, 2500);
      });
    check();
    return () => { stop = true; };
  }, []);
  if (!ready) return null;
  return (
    <Link to="/konto?tab=sesje" className="btn-relic">Wybierz termin teraz <ArrowRight className="h-4 w-4" /></Link>
  );
}