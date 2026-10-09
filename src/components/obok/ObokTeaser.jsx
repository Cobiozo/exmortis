import React from "react";
import { Link } from "react-router-dom";
import { OBOK_SUB } from "./obokApi";

// /obok dla niezalogowanych: czym jest Obok i wejście do konta (powrót na /obok).
export default function ObokTeaser() {
  const back = encodeURIComponent("/obok");
  return (
    <section className="min-h-[80svh] flex items-center px-5 md:px-10 pt-32 pb-24">
      <div className="mx-auto max-w-[70ch]">
        <p className="technical text-[10px] gold-text mb-6">OBOK</p>
        <h1 className="relic-heading text-4xl md:text-6xl text-[#F5EFE1] mb-8">Kilka minut mojego głosu.<br /><span className="gold-text">Na Twoją drogę powrotu.</span></h1>
        <p className="text-lg text-foreground/70 leading-relaxed mb-12">{OBOK_SUB}</p>
        <div className="flex flex-wrap gap-4">
          <Link to={`/register?returnTo=${back}`} className="btn-relic">Załóż darmowe konto</Link>
          <Link to={`/login?returnTo=${back}`} className="btn-ghost">Zaloguj się</Link>
        </div>
      </div>
    </section>
  );
}