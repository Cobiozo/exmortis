import React from "react";
import { useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import CookieTable from "./CookieTable";
import LegalVersions from "./LegalVersions";
import useLegalArchive from "./useLegalArchive";
import { DEFAULT_POLA } from "@/lib/legalFill";
import { renderDoc } from "@/lib/legalRender";
import useSiteSettings from "@/lib/useSiteSettings";

// Dokument prawny: obecna wersja składana z pól; wersja archiwalna (?wersja=) — dokładnie zapisana treść.
export default function LegalPage({ doc, docKey, children }) {
  const s = useSiteSettings();
  const pola = s?.dokumenty?.pola || DEFAULT_POLA;
  const current = s?.dokumenty?.docs?.[docKey] || { version: doc.version || "1.0" };
  const want = new URLSearchParams(useLocation().search).get("wersja");
  const { versions, archived, loading } = useLegalArchive(docKey, want && want !== current.version ? want : null);
  const content = archived ? archived : renderDoc(docKey, s?.firma || {}, pola);
  const shown = archived ? { version: archived.version, date: archived.date, old: true } : current;
  if (loading) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return (
    <div className="bg-[#0A0A0B] pt-28 pb-24 px-5 md:px-10">
      <article className="mx-auto max-w-[70ch]">
        <h1 className="relic-heading text-3xl md:text-5xl mb-4">{content.title}</h1>
        <LegalVersions current={current} shown={shown} versions={versions} dataOd={pola.data_od} />
        <button onClick={() => window.print()} className="btn-ghost !px-4 !py-2 text-[10px] mb-10 print:hidden"><Download className="h-4 w-4" /> POBIERZ PDF</button>
        <nav aria-label="Spis treści" className="border hairline p-5 mb-12 print:hidden">
          <p className="technical text-[10px] gold-text mb-3">SPIS TREŚCI</p>
          <ol className="space-y-1.5 text-sm">
            {content.sections.map((x) => <li key={x.id}><a href={`#${x.id}`} className="text-foreground/70 hover:gold-text">{x.title}</a></li>)}
          </ol>
        </nav>
        {children}
        {content.sections.map((x) => (
          <section key={x.id} id={x.id} className="mb-10 scroll-mt-28">
            <h2 className="shop-heading text-2xl text-[#F5EFE1] mb-4">{x.title}</h2>
            {x.body.map((p, i) => <p key={i} className="text-foreground/75 leading-relaxed mb-3">{p}</p>)}
            {x.table && <CookieTable rows={x.table} />}
          </section>
        ))}
      </article>
    </div>
  );
}