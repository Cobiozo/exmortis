import { rememberJoinEvent } from "@/content/joinFallback";
import React, { useEffect, useState } from "react";
import WarsawNote from "@/components/exmortis/events/WarsawNote";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, MapPin } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { useDocMeta } from "@/lib/useDocMeta";
import { LISTOPAD_EVENT } from "@/components/cms/defaults/listopadDefault";

// Spotkania z własną stroną zapisu: karta zostaje, zapis i adres kanoniczny prowadzą tam.
const LANDINGS = { [LISTOPAD_EVENT]: "/1-listopada", "1-listopada": "/1-listopada" };
import { base44 } from "@/api/base44Client";
import { CoverHero, coverOf } from "@/components/exmortis/events/cover";
import HeroContent from "@/components/exmortis/events/HeroContent";
import StickySignup from "@/components/exmortis/events/StickySignup";
import CalendarButtons from "@/components/exmortis/events/CalendarButtons";
import ZoomFaq from "@/components/exmortis/events/ZoomFaq";
import RegistrationBlock from "@/components/exmortis/events/RegistrationBlock";
import { whenText, durationText, priceText } from "@/components/exmortis/events/time";

// Strona wydarzenia /spotkania/:slug — szczegóły i zapis.
export default function EventDetail() {
  const { slug } = useParams();
  const [event, setEvent] = useState(undefined);
  const [error, setError] = useState("");
  const landing = LANDINGS[slug];
  usePageMeta({ canonical: landing });
  useDocMeta(event?.title ? `${event.title} — Spotkania | exmortis` : "", event?.subtitle || event?.description);

  useEffect(() => {
    setEvent(undefined);
    setError("");
    base44.functions
      .invoke("eventsPublic", { action: "get", slug })
      .then((res) => { setEvent(res.data.event); rememberJoinEvent(res.data.event); })
      .catch(() => {
        setEvent(null);
        setError("Nie znaleziono takiego spotkania.");
      });
  }, [slug]);

  if (event === undefined) {
    return (
      <div className="bg-[#0A0A0B] pt-20 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="bg-[#0A0A0B] pt-20 min-h-screen flex flex-col items-center justify-center gap-6 px-5 text-center">
        <p className="shop-heading text-3xl text-[#F5EFE1]/70">{error || "Nie znaleziono spotkania."}</p>
        <Link to="/spotkania" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> WRÓĆ DO SPOTKAŃ
        </Link>
      </div>
    );
  }

  const cancelled = event.status === "Odwołane";
  const cover = coverOf(event);
  const ended =
    event.start_datetime &&
    new Date(new Date(event.start_datetime).getTime() + (Number(event.duration_minutes) || 60) * 60000) < new Date();

  return (
    <div className="bg-[#0A0A0B] pt-20 overflow-x-hidden">
      {cover && (
        <CoverHero ev={event}>
          <HeroContent ev={event} />
        </CoverHero>
      )}
      <div className="mx-auto max-w-[1200px] px-5 md:px-10 pt-10 md:pt-14 pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
       <div className="min-w-0">
        <Link to="/spotkania" className="inline-block py-3 -my-3 technical text-[10px] text-foreground/50 hover:gold-text transition-colors">
          <ArrowLeft className="h-3.5 w-3.5 inline mr-2 -mt-0.5" /> SPOTKANIA
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="technical text-[9px] text-[#C9A24A] border border-[#C9A24A]/40 px-2 py-1">
            {event.event_type.toUpperCase()}
          </span>
          <span className="technical text-[9px] text-foreground/40 border hairline px-2 py-1">
            {event.stage === "Wszystkie" ? "DROGA: WSZYSTKIE ETAPY" : `ETAP: ${event.stage.toUpperCase()}`}
          </span>
          {cancelled && (
            <span className="technical text-[9px] blood-text border border-[#BC1E22]/40 px-2 py-1">ODWOŁANE</span>
          )}
        </div>

        {!cover && (
          <h1 className="shop-heading text-[#F5EFE1] leading-tight mt-6 break-words [text-wrap:balance]" style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)" }}>{event.title}</h1>
        )}
        {event.subtitle && <p className="italic text-foreground/60 text-lg mt-5">{event.subtitle}</p>}

        <div className="mt-10 grid sm:grid-cols-3 gap-6 border-y hairline py-8">
          <div>
            <p className="technical text-[9px] text-foreground/35 mb-2">KIEDY</p>
            <p className="text-[#F5EFE1]">{whenText(event.start_datetime)}<WarsawNote iso={event.start_datetime} /></p>
            <p className="text-foreground/40 text-sm mt-1">
              <Clock className="h-3.5 w-3.5 inline mr-1 -mt-0.5" /> {durationText(event.duration_minutes)}
            </p>
          </div>
          <div>
            <p className="technical text-[9px] text-foreground/35 mb-2">GDZIE</p>
            <p className="text-[#F5EFE1]">{event.format}</p>
            <p className="text-foreground/40 text-sm mt-1">
              <MapPin className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />{" "}
              {event.format === "Stacjonarnie" ? "Adres otrzymasz po zapisaniu" : event.location || "Online"}
            </p>
          </div>
          <div>
            <p className="technical text-[9px] text-foreground/35 mb-2">CENA</p>
            <p className="text-[#F5EFE1]">{priceText(event.price)}</p>
          </div>
        </div>

        {event.for_whom && (
          <p className="mt-8 text-foreground/70 border-l-2 border-[#5C1A1B] pl-5 leading-relaxed">{event.for_whom}</p>
        )}

        {event.description && (
          <div
            className="rich-content mt-8 text-foreground/70"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
          />
        )}

        {cancelled && (
          <div className="mt-10 border border-[#BC1E22]/40 p-8 text-center">
            <p className="shop-heading text-2xl blood-text">To spotkanie zostało odwołane.</p>
            {event.cancel_reason && (
              <p className="text-foreground/60 mt-3 leading-relaxed">{event.cancel_reason}</p>
            )}
          </div>
        )}

        {(() => {
          if (!event.start_datetime || cancelled) return null;
          const end = new Date(new Date(event.start_datetime).getTime() + (Number(event.duration_minutes) || 60) * 60000);
          if (end >= new Date()) return null;
          return (
            <div className="mt-10 border hairline p-8 text-center">
              <p className="shop-heading text-2xl text-[#F5EFE1]/80">To spotkanie już się odbyło.</p>
              <Link to="/spotkania" className="btn-ghost mt-6">
                ZOBACZ KOLEJNE TERMINY
              </Link>
            </div>
          );
        })()}

        <div className="mt-12">
          <p className="technical text-[10px] text-foreground/40 mb-5">DODAJ DO KALENDARZA</p>
          <CalendarButtons event={event} />
        </div>
        <ZoomFaq event={event} />
       </div>

       <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        {landing && !cancelled && !ended && (
          <div className="mt-16 lg:mt-0 border hairline bg-[#0D0D0E] p-5 sm:p-7">
            <p className="technical text-[10px] gold-text mb-6">ZAPIS</p>
            <Link to={landing} className="btn-relic w-full">ZAPISZ SIĘ <ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}
        {!landing && !cancelled && !ended && event.registration_type !== "Bez zapisu" && (
          <div id="zapis" className="mt-16 lg:mt-0 border hairline bg-[#0D0D0E] p-5 sm:p-7 scroll-mt-28">
            <p className="technical text-[10px] gold-text mb-6">
              {event.registration_type === "Zapis na stronie" ? "ZAPIS" : "DOŁĄCZ"}
            </p>
            <RegistrationBlock event={event} />
          </div>
        )}
        {!cancelled && !ended && event.registration_type === "Bez zapisu" && (
          <div className="mt-16 lg:mt-0">
            <RegistrationBlock event={event} />
          </div>
        )}
       </aside>
      </div>
      {!landing && !cancelled && !ended && event.registration_type === "Zapis na stronie" && <StickySignup />}
    </div>
  );
}