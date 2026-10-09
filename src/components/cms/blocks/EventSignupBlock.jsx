import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RegistrationBlock from "@/components/exmortis/events/RegistrationBlock";
import StickySignup from "@/components/exmortis/events/StickySignup";
import { whenText, durationText, priceText } from "@/components/exmortis/events/time";
import { SectionHead } from "../parts";

// Formularz zapisu na spotkanie — ten sam mechanizm co na karcie spotkania.
export default function EventSignupBlock({ d, label }) {
  const [ev, setEv] = useState(undefined);
  const inEditor = useLocation().pathname.startsWith("/admin");
  useEffect(() => {
    if (!d.spotkanie) return setEv(null);
    base44.functions.invoke("eventsPublic", { action: "get", slug: d.spotkanie })
      .then((r) => setEv(r.data.event)).catch(() => setEv(null));
  }, [d.spotkanie]);

  if (ev === undefined) return <div className="h-40" />;
  if (!ev) return <p className="border border-dashed border-[#BC1E22]/60 p-8 text-center text-foreground/60">Nie znaleziono spotkania „{d.spotkanie}”. Sprawdź adres spotkania w ustawieniach bloku.</p>;
  const end = new Date(new Date(ev.start_datetime).getTime() + (Number(ev.duration_minutes) || 60) * 60000);
  const closed = ev.status === "Odwołane" || end < new Date();
  return (
    <div className="max-w-xl mx-auto">
      <SectionHead label={label} title={d.tytul} center />
      <div id="zapis" className="border hairline bg-[#0D0D0E] p-5 sm:p-7 scroll-mt-28">
        <p className="technical text-[10px] text-foreground/50 mb-6">{whenText(ev.start_datetime)} · {durationText(ev.duration_minutes)} · {ev.format} · {priceText(ev.price)}</p>
        {closed ? <p className="text-foreground/70">{ev.status === "Odwołane" ? "To spotkanie zostało odwołane." : "To spotkanie już się odbyło."}</p>
          : <RegistrationBlock event={ev} />}
      </div>
      {!closed && !inEditor && ev.registration_type === "Zapis na stronie" && <StickySignup />}
    </div>
  );
}