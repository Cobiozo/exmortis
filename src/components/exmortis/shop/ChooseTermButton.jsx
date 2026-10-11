import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight } from "lucide-react";

// MUSI 8/6: po opłaceniu zamówienia — jeśli na koncie czeka pakiet z wolną sesją,
// prowadzimy wprost do wyboru terminu. Gość dostaje link mailem.
export default function ChooseTermButton() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    base44.functions.invoke("bookingPublic", { action: "my_sessions" })
      .then((r) => setReady((r.data.packages || []).some((p) => p.sessions_left > 0)))
      .catch(() => setReady(false));
  }, []);
  if (!ready) return null;
  return (
    <Link to="/konto?tab=sesje" className="btn-relic">WYBIERZ TERMIN TERAZ <ArrowRight className="h-4 w-4" /></Link>
  );
}