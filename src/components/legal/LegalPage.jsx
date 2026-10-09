import React from "react";
import { Download } from "lucide-react";
import { LEGAL_VERSION, LEGAL_FROM } from "@/content/legal/seller";
import CookieTable from "./CookieTable";
import { fillFirma } from "@/lib/firma";
import { useFirma } from "@/lib/useSiteSettings";

// Wspólny układ dokumentu prawnego: spis treści, wersja, data, PDF (druk do PDF).
export default function LegalPage({ doc, extra = [], children }) {
  const sections = [...doc.sections, ...extra];
  const firma = useFirma();
  return (
    <div className="bg-[#0A0A0B] pt-28 pb-24 px-5 md:px-10">
      <article className="mx-auto max-w-[70ch]">
        <h1 className="relic-heading text-3xl md:text-5xl mb-4">{doc.title}</h1>
        <p className="technical text-[10px] text-foreground/50 mb-6">
          Wersja {doc.version || LEGAL_VERSION}{!LEGAL_FROM.startsWith("[") && ` · Obowiązuje od: ${LEGAL_FROM}`}
        </p>
        <div className="flex flex-wrap gap-4 mb-10 print:hidden">
          <button onClick={() => window.print()} className="btn-ghost !px-4 !py-2 text-[10px]"><Download className="h-4 w-4" /> POBIERZ PDF</button>
          <span className="technical text-[10px] text-foreground/40 self-center">{doc.version ? `Poprzednia wersja: ${LEGAL_VERSION}` : "Poprzednie wersje: brak — to pierwsza wersja"}</span>
        </div>
        <nav aria-label="Spis treści" className="border hairline p-5 mb-12 print:hidden">
          <p className="technical text-[10px] gold-text mb-3">SPIS TREŚCI</p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-foreground/70 hover:gold-text">{s.title}</a></li>)}
          </ol>
        </nav>
        {children}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-10 scroll-mt-28">
            <h2 className="shop-heading text-2xl text-[#F5EFE1] mb-4">{s.title}</h2>
            {s.body.map((p) => fillFirma(p, firma)).filter(Boolean).map((p, i) => <p key={i} className="text-foreground/75 leading-relaxed mb-3">{p}</p>)}
            {s.table && <CookieTable />}
          </section>
        ))}
      </article>
    </div>
  );
}