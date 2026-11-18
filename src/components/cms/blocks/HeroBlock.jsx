import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/exmortis/Logo";
import { CmsButton } from "../parts";
import SafeImg from "../SafeImg";
import { nbsp } from "@/lib/nbsp";
import { useBefore } from "@/lib/wawDate";
import HeroOsobisty from "./HeroOsobisty";
import HeroZnak from "./HeroZnak";

function Bg({ d }) {
  if (!d.tlo?.url) return null;
  return (
    <div className="absolute inset-0">
      <SafeImg img={{ ...d.tlo, alt: "" }} eager className="w-full h-full" style={{ opacity: 1 - (d.przyciemnienie ?? 60) / 100 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B]/60 to-[#0A0A0B]" />
    </div>
  );
}

const Dopisek = ({ t }) => t ? <p className="technical text-xs text-foreground/75 mt-3">{t}</p> : null;

// Kto stoi za stroną: małe zdjęcie i podpis z linkiem do „O mnie” (audyt 17.11.2026, X-07).
function Autor({ d }) {
  if (!d.autor_zdjecie?.url && !d.autor_podpis) return null;
  return (
    <Link to="/o-mnie" className="group mt-6 md:mt-8 inline-flex items-center gap-3 text-left min-h-11">
      {d.autor_zdjecie?.url && (
        <SafeImg img={{ ...d.autor_zdjecie, alt: d.autor_zdjecie.alt || d.autor_podpis || "" }} sizes="56px"
          className="h-12 w-12 md:h-14 md:w-14 rounded-full border border-[#C9A24A]/50 shrink-0" />
      )}
      {d.autor_podpis && <span className="text-sm text-foreground/75 group-hover:text-[#C9A24A] transition-colors">{d.autor_podpis}</span>}
    </Link>
  );
}

// Podpis pod głównym przyciskiem — drobny tekst, zawsze bezpośrednio pod pierwszym przyciskiem.
const Podpis = ({ t }) => t
  ? <p className="text-[11px] md:text-xs text-foreground/55 leading-relaxed max-w-[280px]">{t}</p>
  : null;

// Przyciski hero: pierwszy z podpisem, pozostałe obok (na telefonie jeden pod drugim).
function HeroButtons({ d, className = "", center }) {
  const list = d.przyciski || [];
  if (!list.length) return null;
  const [first, ...rest] = list;
  const lay = d.przyciski_pion ? "flex flex-col gap-3" : "flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-3 sm:gap-4";
  return (
    <div className={`${lay} ${center ? "sm:justify-center" : ""} ${className}`}>
      <div className="flex flex-col gap-3">
        <CmsButton b={first} />
        <Podpis t={d.podpis_przycisku} />
      </div>
      {rest.map((b, i) => <CmsButton key={i} b={b} />)}
    </div>
  );
}

// Informacja przy przyciskach (np. „Zapisy ruszają 16 października”) — znika sama o podanej godzinie (czas polski).
function Zapowiedz({ d, center }) {
  const before = useBefore(d.zapowiedz_do);
  if (!d.zapowiedz || (d.zapowiedz_do && !before)) return null;
  return (
    <p data-shell-until={d.zapowiedz_do || undefined} className={`technical text-[11px] gold-text flex items-center gap-2.5 mt-10 -mb-6 ${center ? "justify-center" : ""}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24A] animate-pulse shrink-0" aria-hidden="true" />{d.zapowiedz}
    </p>
  );
}

// Nagłówek strony (H1). Wariant „znak” = pełnoekranowy hero strony głównej z logo.
export default function HeroBlock({ d }) {
  // Wariant „osobisty” (17.11.2026): portret, odtwarzacz i pasek skrótów — osobny plik.
  if (d.wariant === "osobisty") return <HeroOsobisty d={d} />;
  // Wariant „znak” przebudowany 18.11.2026 (etap 2): własny plik HeroZnak.
  if (d.wariant === "znak") return <HeroZnak d={d} />;

  // Od 17.11.2026 wszystkie nagłówki stron (wariant standard) są kompaktowe: niższa sekcja i mniejszy tytuł,
  // treść strony szybciej widoczna. Dawny duży nagłówek: rozmiar „duzy” w danych bloku.
  const k = d.rozmiar !== "duzy";
  const box = k
    ? `${d.tlo?.url ? "min-h-[50vh] md:min-h-[56vh]" : "min-h-[34svh] md:min-h-[42vh]"} pt-28 md:pt-32 pb-10 md:pb-14`
    : `${d.tlo?.url ? "min-h-[70vh] pt-40" : "min-h-[50svh] md:min-h-[70vh] pt-32 md:pt-40"} pb-16 md:pb-20`;
  return (
    // Bez zdjęcia w tle na telefonie niższy nagłówek — inaczej nad tytułem zostaje pusty ekran.
    <section className={`relative ${box} flex items-end overflow-hidden grain px-5 md:px-10`}>
      <Bg d={d} />
      <div className="relative z-10 mx-auto max-w-[1400px] w-full">
        {d.etykieta && <p className={`technical text-[11px] gold-text ${k ? "mb-4" : "mb-6"}`}>{d.etykieta}</p>}
        <h1 className={`relic-heading ${k ? "text-[clamp(2rem,9vw,2.75rem)] md:text-6xl lg:text-[4.25rem]" : "text-[clamp(2rem,10.5vw,3rem)] md:text-7xl lg:text-8xl"}`}>
          <span className="block">{nbsp(d.linia1)}</span>
          {d.linia2 && <span className="block gold-text">{nbsp(d.linia2)}</span>}
        </h1>
        {d.lead && <p className={`no-hyph ${k ? "mt-5 text-base md:text-lg" : "mt-8 text-lg md:text-xl"} text-foreground/70 max-w-2xl leading-relaxed`}>{nbsp(d.lead)}</p>}
        {d.podlead && <p className="no-hyph mt-3 text-foreground/55 max-w-2xl">{d.podlead}</p>}
        <Zapowiedz d={d} />
        <HeroButtons d={d} className="mt-10" />
        <Dopisek t={d.dopisek} />
      </div>
    </section>
  );
}