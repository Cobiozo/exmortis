import { rememberJoinEvent } from "@/content/joinFallback";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { usePageMeta } from "@/lib/usePageMeta";
import { useDocMeta } from "@/lib/useDocMeta";
import { LISTOPAD_EVENT } from "@/components/cms/defaults/listopadDefault";
import { base44 } from "@/api/base44Client";
import Container from "@/components/exmortis/ui/Container";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import EventHero from "@/components/exmortis/events/EventHero";
import StickySignup from "@/components/exmortis/events/StickySignup";
import CalendarButtons from "@/components/exmortis/events/CalendarButtons";
import ZoomFaq from "@/components/exmortis/events/ZoomFaq";
import WhoLeads from "@/components/exmortis/events/WhoLeads";
import RegistrationBlock from "@/components/exmortis/events/RegistrationBlock";
import JsonLd from "@/components/seo/JsonLd";
import { eventJsonLd } from "@/lib/structuredData";

// Spotkania z własną stroną zapisu: karta zostaje, zapis i adres kanoniczny prowadzą tam.
const LANDINGS = { [LISTOPAD_EVENT]: "/1-listopada", "1-listopada": "/1-listopada" };

// Strona wydarzenia /spotkania/:slug — pierwszy ekran z faktami, opis z danych, zapis i kalendarz.
// Telefon: formularz zaraz po faktach (kolejność w DOM), komputer: przyklejona kolumna zapisu po prawej.
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
      <div className="flex min-h-[70svh] items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-exm-line border-t-exm-gold" role="status" aria-label="Wczytuję spotkanie" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="flex min-h-[70svh] flex-col items-center justify-center gap-6 px-5 pt-20 text-center">
        <p className="exm-h3 text-exm-muted">{error || "Nie znaleziono spotkania."}</p>
        <BrandButton to="/spotkania" variant="secondary">Wróć do spotkań</BrandButton>
      </div>
    );
  }

  const cancelled = event.status === "Odwołane";
  const ended =
    event.start_datetime &&
    new Date(new Date(event.start_datetime).getTime() + (Number(event.duration_minutes) || 60) * 60000) < new Date();
  // Blok zapisu tylko dla spotkań, na które można się jeszcze zapisać.
  const withForm = !cancelled && !ended && event.registration_type !== "Bez zapisu";

  return (
    <div className="pt-20">
      <JsonLd data={eventJsonLd(event)} />

      <Container className="pt-4 md:pt-6">
        <Link to="/spotkania" className="btn-link">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Spotkania
        </Link>
      </Container>

      <Container className="pt-6 pb-[var(--exm-section-y)]">
        <div className={withForm ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-14 lg:gap-y-0" : "max-w-[820px]"}>
          <div className={withForm ? "min-w-0 lg:col-start-1 lg:row-start-1" : "min-w-0"}>
            <EventHero ev={event} landing={landing} ended={ended} />
          </div>

          {withForm && (
            <aside
              id="zapis"
              className="min-w-0 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
            >
              <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 sm:p-7">
                <p className="exm-eyebrow mb-5">
                  {event.registration_type === "Zapis na stronie" ? "Zapis" : "Dołącz"}
                </p>
                {landing
                  ? <BrandButton to={landing} className="w-full">Zapisz się</BrandButton>
                  : <RegistrationBlock event={event} />}
              </div>
            </aside>
          )}

          <div className={withForm ? "min-w-0 lg:col-start-1 lg:row-start-2" : "min-w-0"}>
            {event.for_whom && (
              <p className="border-l-2 border-exm-gold pl-5 text-[16px] leading-relaxed text-exm-muted">
                {event.for_whom}
              </p>
            )}

            {event.description && (
              <div className="prose-measure mt-10">
                <p className="exm-eyebrow mb-3">O spotkaniu</p>
                <div
                  className="rich-content text-exm-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
                />
              </div>
            )}

            {cancelled && (
              <div className="mt-10 rounded-[var(--exm-r-card)] border border-exm-bordo bg-exm-surface p-6 sm:p-8">
                <p className="exm-h3">To spotkanie zostało odwołane.</p>
                {event.cancel_reason && (
                  <p className="mt-3 leading-relaxed text-exm-muted">{event.cancel_reason}</p>
                )}
              </div>
            )}

            {ended && !cancelled && (
              <div className="mt-10 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 sm:p-8">
                <p className="exm-h3">To spotkanie już się odbyło.</p>
                <p className="mt-3 leading-relaxed text-exm-muted">Kolejne terminy znajdziesz na liście spotkań.</p>
                <BrandButton to="/spotkania" variant="secondary" className="mt-5">Zobacz kolejne terminy</BrandButton>
              </div>
            )}

            <CalendarButtons event={event} className="mt-10" />
            {event.kto_prowadzi !== false && <WhoLeads />}
            <ZoomFaq event={event} />
          </div>
        </div>
        {/* Koniec treści — pasek zapisu na telefonie chowa się tutaj, żeby nie zasłaniał ostatnich sekcji. */}
        <div id="spotkanie-koniec" aria-hidden="true" className="h-px" />
      </Container>

      {withForm && !landing && event.registration_type === "Zapis na stronie" && (
        <StickySignup event={event} endId="spotkanie-koniec" />
      )}
    </div>
  );
}