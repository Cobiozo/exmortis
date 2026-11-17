import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { POWROT, POWROT_TEASER } from "@/lib/powrotOffer";
import { track } from "@/lib/track";

// Strona główna: wizytówka programu POWRÓT. Od 17.11.2026: konkrety (czas, sesje, forma, start, cena)
// i dwa wejścia — pełny program albo pojedyncza Rozmowa na progu. Dane z powrotOffer (jedno źródło).
export default function PowrotTeaser({ label } = {}) {
  const { rich } = useSiteContent();
  const quote = rich("home", "powrotTeaserQuote", "„Nowa wersja Ciebie nie powstaje z tej samej gliny, co poprzednia.<br />Trzeba ją wypalić.”");
  const desc = rich("home", "powrotTeaserDesc", POWROT_TEASER);
  const facts = [
    ["Czas", POWROT.months],
    ["Sesje", `${POWROT.sessions} × ${POWROT.length}`],
    ["Forma", `1:1 · ${POWROT.form}`],
    ["Start", POWROT.start],
  ];
  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-5 md:px-10 border-t hairline overflow-hidden"
      style={{ background: "radial-gradient(70% 90% at 85% 10%, rgba(201,162,74,.10), transparent 70%), #0A0A0B" }}>
      <div className="mx-auto max-w-[1200px] grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5">
          <p className="technical text-[11px] gold-text">{label || "MENTORING 1:1"}</p>
          <h2 className="relic-heading text-[56px] md:text-[80px] leading-[0.95] gold-text mt-2">POWRÓT</h2>
          <p className="relic-heading text-2xl md:text-[28px] leading-snug text-[#F5EFE1]/85 mt-6" dangerouslySetInnerHTML={{ __html: sanitizeHtml(quote) }} />
        </div>
        <div className="lg:col-span-7 rounded-2xl border border-[#C9A24A]/35 bg-[#111113]/90 p-6 md:p-8">
          <div className="rich-content text-[#F5EFE1]/75 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(desc) }} />
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-xl border hairline bg-[#0F0F10] p-3">
                <dt className="technical text-[9px] text-[#F5EFE1]/55">{k.toUpperCase()}</dt>
                <dd className="text-[15px] text-[#F5EFE1] mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-7">
            <Link to="/powrot?src=home" onClick={() => track("home_powrot_click", { cel: "program" })} className="btn-relic">
              Poznaj POWRÓT <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/skarbiec/rozmowa-na-progu?src=home-powrot" onClick={() => track("home_powrot_click", { cel: "rozmowa" })} className="btn-ghost">
              Zacznij od jednej rozmowy
            </Link>
          </div>
          <p className="text-[13px] text-[#F5EFE1]/55 mt-4">Pełny program: {POWROT.priceText}. Na zgłoszenia odpowiadam osobiście w ciągu 72 godzin.</p>
        </div>
      </div>
    </section>
  );
}
