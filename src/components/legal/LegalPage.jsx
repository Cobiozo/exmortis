import React from "react";
import { useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import CookieTable from "./CookieTable";
import LegalVersions from "./LegalVersions";
import { fillFirma } from "@/lib/firma";
import { fillDocs, DEFAULT_POLA } from "@/lib/legalFill";
import useSiteSettings from "@/lib/useSiteSettings";

// Wspólny układ dokumentu prawnego: wersja, poprzednie wersje, spis treści, PDF (druk do PDF).
export default function LegalPage({ doc, docKey, extra = [], children }) {
  const sections = [...doc.sections, ...extra];
  const s = useSiteSettings();
  const firma = s?.firma || {};
  const info = s?.dokumenty?.docs?.[docKey] || { version: doc.version || "1.0", archiwum: [] };
  const want = new URLSearchParams(useLocation().search).get("wersja");
  const old = want && (info.archiwum || []).find((a) => a.version === want);
  const pola = old ? old.pola || {} : s?.dokumenty?.pola || DEFAULT_POLA;
  const shown = old ? { ...old, old: true } : info;
  return (
    <div className="bg-[#0A0A0B] pt-28 pb-24 px-5 md:px-10">
      <article className="mx-auto max-w-[70ch]">
        <h1 className="relic-heading text-3xl md:text-5xl mb-4">{doc.title}</h1>
        <LegalVersions info={info} shown={shown} pola={pola} />
        <button onClick={() => window.print()} className="btn-ghost !px-4 !py-2 text-[10px] mb-10 print:hidden"><Download className="h-4 w-4" /> POBIERZ PDF</button>
        <nav aria-label="Spis treści" className="border hairline p-5 mb-12 print:hidden">
          <p className="technical text-[10px] gold-text mb-3">SPIS TREŚCI</p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((x) => <li key={x.id}><a href={`#${x.id}`} className="text-foreground/70 hover:gold-text">{x.title}</a></li>)}
          </ol>
        </nav>
        {children}
        {sections.map((x) => (
          <section key={x.id} id={x.id} className="mb-10 scroll-mt-28">
            <h2 className="shop-heading text-2xl text-[#F5EFE1] mb-4">{x.title}</h2>
            {x.body.map((p) => fillDocs(fillFirma(p, firma), pola)).filter(Boolean).map((p, i) => <p key={i} className="text-foreground/75 leading-relaxed mb-3">{p}</p>)}
            {x.table && <CookieTable pola={pola} />}
          </section>
        ))}
      </article>
    </div>
  );
}