import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export default function PowrotTeaser() {
  const { rich } = useSiteContent();
  const quote = rich("home", "powrotTeaserQuote", "„Nowa wersja Ciebie nie powstaje z tej samej gliny, co poprzednia.<br />Trzeba ją wypalić.”");
  const desc = rich("home", "powrotTeaserDesc", "Autorski program mentorski exmortis — dla tych, którzy wychodzą ze śmierci mentalnej, duchowej albo życiowej. Sześć miesięcy, cztery etapy, osiem sesji jeden na jeden. Prowadzę maksymalnie cztery osoby jednocześnie.");
  return (
    <section className="relative py-32 px-5 md:px-10 border-t hairline bg-[#070708] overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-5">
          <p className="technical text-[11px] gold-text mb-4">POWRÓT · 06</p>
          <h2 className="relic-heading text-5xl lg:text-7xl xl:text-8xl gold-text leading-[0.9] [overflow-wrap:break-word]">
            POWRÓT
          </h2>
        </div>
        <div className="md:col-span-7">
          <p className="relic-heading text-2xl md:text-3xl leading-tight text-foreground/85 mb-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(quote) }} />
          <div className="rich-content text-foreground/60 leading-relaxed max-w-xl mb-10" dangerouslySetInnerHTML={{ __html: sanitizeHtml(desc) }} />
          <Link to="/powrot" className="btn-relic">
            POZNAJ POWRÓT <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}