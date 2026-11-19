import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/exmortis/Logo";

// Pierwszy ekran strony głównej — wariant „znak” (etap 2, 18.11.2026).
// Sygnet → EXMORTIS → ZE ŚMIERCI → zdanie → złota linia → Dawid, mentor powrotu → opis → dwa przyciski.
// Jeden H1: napis jest dla czytników jeden raz (nagłówek ukryty, elementy ozdobne aria-hidden).
// Tło: zdjęcie z pola „tlo” (komputer) i „tlo_mobile” (telefon), mocno przyciemnione; czerń dominuje.
const STY = { zloty: "btn-relic", obrys: "btn-ghost", tekst: "btn-link" };

function HeroBtn({ b }) {
  const cls = `${STY[b.styl] || STY.zloty} w-full sm:w-auto`;
  const inner = <>{b.etykieta}{b.strzalka && <ArrowRight className="h-4 w-4" aria-hidden="true" />}</>;
  const link = b.link || "/";
  if (/^(https:|mailto:|tel:|#)/i.test(link)) {
    return <a href={link} className={cls}>{inner}</a>;
  }
  return <Link to={link} className={cls}>{inner}</Link>;
}

// Tło: telefon dostaje kadr pionowy, komputer poziomy. Obraz jest ozdobny (alt pusty), ładowany od razu.
function Tlo({ d }) {
  const wide = d.tlo?.url;
  const tall = d.tlo_mobile?.url;
  if (!wide && !tall) return null;
  const jasnosc = 1 - Math.min(95, Math.max(0, d.przyciemnienie ?? 70)) / 100;
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <picture>
        {tall && <source media="(max-width: 639px)" srcSet={tall} />}
        <img
          src={wide || tall}
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover"
          style={{ opacity: jasnosc, objectPosition: `${d.tlo?.fx ?? 50}% ${d.tlo?.fy ?? 50}%` }}
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-b from-exm-bg via-transparent to-exm-bg" />
    </div>
  );
}

export default function HeroZnak({ d = {} }) {
  const napis = d.linia1 || "EXMORTIS";
  const dopelnienie = d.linia2 || "ZE ŚMIERCI";
  const przyciski = d.przyciski?.length
    ? d.przyciski
    : [
        { etykieta: "Poznaj drogę powrotu", link: "#rozpoznanie", styl: "zloty", strzalka: true },
        { etykieta: "Poznaj moją historię", link: "/o-mnie", styl: "obrys" },
      ];

  return (
    <section className="relative isolate flex min-h-[88svh] items-center justify-center overflow-hidden bg-exm-bg">
      <Tlo d={d} />

      <div className="relative z-10 mx-auto w-full max-w-[var(--exm-container)] px-[var(--exm-pad)] py-14 text-center md:py-20">
        <Logo className="mx-auto h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24" />

        {d.etykieta && <p className="exm-eyebrow mt-6">{d.etykieta}</p>}

        {/* Napis marki — jeden H1 dla czytników, bez podwójnego odczytu. */}
        <h1 className="sr-only">{`${napis} — ${dopelnienie}`}</h1>
        <p aria-hidden="true" className="mt-5 md:mt-7">
          <span className="exm-wordmark block whitespace-nowrap text-exm-ivory text-[clamp(2.4rem,12vw,6.5rem)] tracking-[0.16em] sm:tracking-[0.24em]">
            {napis}
          </span>
          <span className="exm-wordmark mt-2 block whitespace-nowrap uppercase text-exm-gold text-[clamp(0.95rem,4.4vw,2.4rem)] tracking-[0.3em] sm:tracking-[0.4em]">
            {dopelnienie}
          </span>
        </p>

        {d.lead && (
          <p className="no-hyph mx-auto mt-7 max-w-[26ch] text-balance font-exm-serif text-exm-ivory text-[clamp(1.125rem,2.6vw,1.75rem)] leading-snug md:mt-9 md:max-w-[34ch]">
            {d.lead}
          </p>
        )}

        <span aria-hidden="true" className="mx-auto mt-8 block h-px w-14 bg-exm-gold md:mt-10" />

        {d.autor_podpis && <p className="mt-6 text-sm text-exm-muted">{d.autor_podpis}</p>}
        {d.podlead && (
          <p className="no-hyph mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-exm-muted md:text-base">
            {d.podlead}
          </p>
        )}

        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          {przyciski.map((b, i) => <HeroBtn key={i} b={b} />)}
        </div>

        {d.dopisek && <p className="technical mt-6 text-[11px] text-exm-muted">{d.dopisek}</p>}
      </div>
    </section>
  );
}