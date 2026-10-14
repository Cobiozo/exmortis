import { rememberJoinEvent } from "@/content/joinFallback";
import React, { useEffect, useState } from "react";
import WarsawNote from "@/components/exmortis/events/WarsawNote";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RegistrationBlock from "@/components/exmortis/events/RegistrationBlock";
import StickySignup from "@/components/exmortis/events/StickySignup";
import { whenText, durationText, priceText } from "@/components/exmortis/events/time";
import { SectionHead } from "../parts";
import { readCache, writeCache } from "@/lib/swrCache";
import { takeEvent } from "@/lib/prefetch";
import { useBefore, parseWaw, plDay } from "@/lib/wawDate";
import { useAdminMode } from "@/components/admin/AdminModeContext";

// Przed startem zapisów: komunikat zamiast formularza (admin w trybie admina widzi formularz do testów).
function NotYet({ od }) {
  return (
    <div className="text-center py-2">
      <p className="technical text-[11px] gold-text mb-3">ZAPISY RUSZAJĄ {plDay(parseWaw(od)).toUpperCase()}</p>
      <p className="text-foreground/70 leading-relaxed">Formularz zapisu pojawi się tutaj {plDay(parseWaw(od))}. Spotkanie jest bezpłatne, a link przyjdzie e-mailem po zapisie.</p>
    </div>
  );
}

// Formularz zapisu na spotkanie — ten sam mechanizm co na karcie spotkania.
export default function EventSignupBlock({ d, label }) {
  // Formularz od razu: z kopii w przeglądarce albo w wersji podstawowej; status spotkania dochodzi w tle.
  const initial = () => d.spotkanie ? (readCache("events")?.[d.spotkanie] || { slug: d.spotkanie, registration_type: "Zapis na stronie", status: "Opublikowane" }) : null;
  const [ev, setEv] = useState(initial);
  const inEditor = useLocation().pathname.startsWith("/admin");
  const notYet = useBefore(d.zapisy_od);
  const { adminView } = useAdminMode();
  useEffect(() => {
    if (!d.spotkanie) return setEv(null);
    (takeEvent(d.spotkanie) || base44.functions.invoke("eventsPublic", { action: "get", slug: d.spotkanie }).then((r) => r.data.event))
      .then((e) => { setEv(e || null); rememberJoinEvent(e); writeCache("events", { ...(readCache("events") || {}), [d.spotkanie]: e || undefined }); })
      .catch((err) => { if (err?.response?.status === 404) setEv(null); });
  }, [d.spotkanie]);

  if (!ev) return <p className="border border-dashed border-[#BC1E22]/60 p-8 text-center text-foreground/60">Nie znaleziono spotkania „{d.spotkanie}”. Sprawdź adres spotkania w ustawieniach bloku.</p>;
  const end = ev.start_datetime ? new Date(new Date(ev.start_datetime).getTime() + (Number(ev.duration_minutes) || 60) * 60000) : null;
  const closed = ev.status === "Odwołane" || (end && end < new Date());
  return (
    <div className="max-w-xl mx-auto">
      <SectionHead label={label} title={d.tytul} center />
      <div id="zapis" className="border hairline bg-[#0D0D0E] p-5 sm:p-7 scroll-mt-28">
        <p className="technical text-[10px] text-foreground/55 mb-6 min-h-[1.5em]">{ev.start_datetime && <>{whenText(ev.start_datetime)} · {durationText(ev.duration_minutes)} · {ev.format} · {priceText(ev.price)}<WarsawNote iso={ev.start_datetime} /></>}</p>
        {closed ? <p className="text-foreground/70">{ev.status === "Odwołane" ? "To spotkanie zostało odwołane." : "To spotkanie już się odbyło."}</p>
          : notYet && !adminView ? <NotYet od={d.zapisy_od} />
          : <>
            {notYet && <p className="technical text-[10px] text-[#E8676A] mb-5">PODGLĄD ADMINA: GOŚCIE ZOBACZĄ FORMULARZ {plDay(parseWaw(d.zapisy_od)).toUpperCase()}</p>}
            <RegistrationBlock event={ev} />
          </>}
      </div>
      {!closed && !inEditor && ev.registration_type === "Zapis na stronie" && <StickySignup label={ev.tickets && Number(ev.price) > 0 ? "KUP BILET" : "ZAPISZ SIĘ"} />}
    </div>
  );
}