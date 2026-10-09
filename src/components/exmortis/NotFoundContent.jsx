import React from "react";
import { Link } from "react-router-dom";
import useSystemText from "@/content/useSystemText";

// Treść strony 404 (teksty z zakładki „Teksty systemowe”).
export default function NotFoundContent() {
  const t = useSystemText();
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="technical text-[11px] gold-text">{t("nf.etykieta")}</p>
      <h1 className="relic-heading text-4xl md:text-6xl">{t("nf.tytul")}</h1>
      <p className="text-foreground/60 max-w-md leading-relaxed">{t("nf.tekst")}</p>
      <Link to="/" className="btn-ghost">{t("nf.przycisk")}</Link>
    </div>
  );
}