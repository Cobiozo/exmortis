import React from "react";
import { Link } from "react-router-dom";
import SafeImg from "../SafeImg";
import { Buttons, Rich, SectionHead } from "../parts";
import { ratioClass } from "../ratios";
import { embed } from "./MediaBlocks";
import ExternalEmbed from "@/components/common/ExternalEmbed";
import { nbsp } from "@/lib/nbsp";

// Strona „O mnie” — etap 7 (18.11.2026). Sekcje w systemie wizualnym marki: tokeny --exm-*,
// wąska kolumna tekstu (≤ 720 px), odstępy wyłącznie z --exm-section-y, naprzemienne tła bg/surface.
// Treść pochodzi z bloków CMS (defaults/aboutDefault.js) — komponenty nie zawierają zdań autorskich.

// Piosenka: przed zgodą cookies okładka z tytułem i przyciskiem (nic nie idzie do YouTube),
// po zgodzie odtwarzacz. Wspólny mechanizm zgody: ExternalEmbed.
function Song({ url, tytul, podpis }) {
  const e = embed(url);
  if (!e) return null;
  return (
    <figure>
      <div className="aspect-video w-full overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg">
        <ExternalEmbed provider="YouTube" what="piosenkę" title={tytul} className="h-full w-full">
          {() => (e.src
            ? <iframe src={e.src} title={tytul || podpis || "Piosenka"} className="h-full w-full" loading="lazy"
                allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            : <video src={e.file} controls playsInline preload="metadata" className="h-full w-full object-contain" />)}
        </ExternalEmbed>
      </div>
      {podpis && <figcaption className="mt-3 text-[13px] leading-relaxed text-exm-muted">{podpis}</figcaption>}
    </figure>
  );
}

// 1. Pierwszy ekran: etykieta, H1 w dwóch liniach, imię i rola, lead, portret.
export function AboutHero({ d }) {
  const [imie, rola] = String(d.imie || "").split("·").map((s) => s.trim());
  return (
    <section className="relative overflow-hidden grain px-5 pb-[calc(var(--exm-section-y)*0.5)] pt-28 md:px-10 md:pt-36">
      <div className="mx-auto grid w-full max-w-[var(--exm-container)] items-end gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:gap-14">
        <div className="min-w-0">
          {d.etykieta && <p className="exm-eyebrow">{d.etykieta}</p>}
          <h1 className="exm-h1 mt-5">
            <span className="block">{nbsp(d.linia1)}</span>
            {d.linia2 && <span className="block text-exm-gold">{nbsp(d.linia2)}</span>}
          </h1>
          {imie && (
            <p className="mt-6 text-[16px] leading-relaxed text-exm-muted">
              <span className="text-exm-ivory">{imie}</span>{rola ? ` · ${rola}` : ""}
            </p>
          )}
          {d.lead && <p className="no-hyph mt-4 max-w-[56ch] text-[17px] leading-relaxed text-exm-muted">{nbsp(d.lead)}</p>}
        </div>
        {d.portret?.url && (
          <figure className="mx-auto w-full max-w-[340px] md:mx-0 md:justify-self-end">
            <SafeImg img={d.portret} eager sizes="(min-width: 768px) 340px, 82vw"
              className="aspect-[4/5] max-h-[420px] w-full rounded-[var(--exm-r-card)] border border-exm-line" />
          </figure>
        )}
      </div>
    </section>
  );
}

// 2. Historia przełomu: rozdziały z krótkimi śródtytułami w wąskiej kolumnie.
//    Piosenka wchodzi po wybranym rozdziale (piosenka_po), więc stoi przy właściwym fragmencie.
export function AboutHistoria({ d, label }) {
  const rozdzialy = d.rozdzialy || [];
  const po = Number(d.piosenka_po) || 0;
  const piosenka = <Song url={d.piosenka_url} tytul={d.piosenka_tytul} podpis={d.piosenka_podpis} />;
  return (
    <>
      {(d.etykieta || label) && <p className="exm-eyebrow">{d.etykieta || label}</p>}
      <div className="mt-8 max-w-[var(--exm-container-narrow)]">
        {rozdzialy.map((r, i) => (
          <div key={i} className={i ? "mt-12" : ""}>
            {r.tytul && <h2 className="exm-h3 text-[clamp(1.25rem,2.4vw,1.6rem)]">{r.tytul}</h2>}
            <Rich html={r.tresc} className="mt-3 text-[17px] leading-relaxed text-exm-muted" />
            {po === i + 1 && d.piosenka_url && <div className="mt-8">{piosenka}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

// 3 i 4. Zdjęcie obok tekstu; pod spodem (opcjonalnie) krótkie zdanie i piosenka — jedna sekcja.
export function AboutZdjecie({ d, label }) {
  const prawo = d.strona === "prawo";
  return (
    <div>
      <div className="grid items-start gap-8 md:grid-cols-2 md:gap-14">
        <figure className={prawo ? "md:order-2" : ""}>
          {d.zdjecie?.url ? (
            <SafeImg img={d.zdjecie} sizes="(min-width: 768px) 45vw, 100vw"
              className={`max-h-[420px] w-full ${ratioClass(d.zdjecie, d.proporcja || "4:5")} rounded-[var(--exm-r-card)] border border-exm-line`} />
          ) : (
            <div className={`max-h-[420px] w-full ${ratioClass(null, d.proporcja || "4:5")} rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2`} />
          )}
          {d.podpis && <figcaption className="mt-3 text-[12px] leading-relaxed text-exm-muted">{d.podpis}</figcaption>}
        </figure>
        <div className={`min-w-0 ${prawo ? "md:order-1" : ""}`}>
          {(d.etykieta || label) && <p className="exm-eyebrow">{d.etykieta || label}</p>}
          {d.tytul && <h2 className="exm-h2 mt-4 whitespace-pre-line text-[clamp(1.5rem,2.6vw,2rem)]">{nbsp(d.tytul)}</h2>}
          <Rich html={d.tresc} className="mt-4 text-[17px] leading-relaxed text-exm-muted" />
        </div>
      </div>
      {(d.piosenka_wstep || d.piosenka_url) && (
        <div className="mt-10 max-w-[var(--exm-container-narrow)]">
          {d.piosenka_wstep && <p className="text-[15px] leading-relaxed text-exm-muted">{nbsp(d.piosenka_wstep)}</p>}
          <div className="mt-4"><Song url={d.piosenka_url} tytul={d.piosenka_tytul} podpis={d.piosenka_podpis} /></div>
        </div>
      )}
    </div>
  );
}

// 5. Droga: cztery etapy jako pozioma mapa (na telefonie pionowa oś) — jak na stronie głównej.
export function AboutDroga({ d, label }) {
  const etapy = d.elementy || [];
  return (
    <>
      <SectionHead label={d.etykieta || label} title={d.tytul} />
      <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
        <span aria-hidden="true" className="absolute left-[13px] top-3 bottom-3 w-px bg-exm-line-strong md:hidden" />
        <span aria-hidden="true" className="absolute left-[13px] right-[13px] top-[13px] hidden h-px bg-exm-line-strong md:block" />
        {etapy.map((e, i) => (
          <li key={i} className="relative min-w-0 pl-10 md:pl-0">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 grid h-[27px] w-[27px] place-items-center rounded-full border border-exm-gold-line bg-exm-bg text-[10px] font-medium text-exm-gold md:static md:mb-6"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="exm-h3">{e.tytul}</h3>
            {e.opis && <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{e.opis}</p>}
          </li>
        ))}
      </ol>
      {d.nota && <p className="mt-10 max-w-[60ch] text-[14px] leading-relaxed text-exm-muted">{d.nota}</p>}
    </>
  );
}

// 6. Dwa zwarte rozdziały: jak pracuję i granice. Karty w dwóch kolumnach, bez numeracji.
function Chapter({ etykieta, tytul, wstep, karty, zamkniecieEtykieta, zamkniecie, wyroznienie = false, className = "" }) {
  const list = karty || [];
  return (
    <div className={className}>
      {etykieta && <p className="exm-eyebrow">{etykieta}</p>}
      {tytul && <h2 className="exm-h2 mt-4 whitespace-pre-line text-[clamp(1.5rem,2.8vw,2.1rem)]">{nbsp(tytul)}</h2>}
      {wstep && <Rich html={wstep} className="mt-4 max-w-[70ch] text-[17px] leading-relaxed text-exm-muted" />}
      {list.length > 0 && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {list.map((c, i) => (
            <div key={i} className="min-w-0 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:p-6">
              <h3 className="exm-h3 text-[18px]">{c.tytul}</h3>
              {c.opis && <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{c.opis}</p>}
            </div>
          ))}
        </div>
      )}
      {zamkniecie && (
        wyroznienie
          ? <p className="mt-6 font-exm-serif text-[clamp(1.25rem,2.2vw,1.5rem)] leading-snug text-exm-gold">{zamkniecie}</p>
          : (
            <div className="mt-8 max-w-[70ch]">
              {zamkniecieEtykieta && <p className="exm-eyebrow">{zamkniecieEtykieta}</p>}
              <Rich html={zamkniecie} className="mt-3 text-[17px] leading-relaxed text-exm-muted" />
            </div>
          )
      )}
    </div>
  );
}

export function AboutPraca({ d }) {
  return (
    <>
      <Chapter etykieta={d.a_etykieta} tytul={d.a_tytul} wstep={d.a_wstep} karty={d.a_karty}
        zamkniecieEtykieta={d.a_zamkniecie_etykieta} zamkniecie={d.a_zamkniecie} />
      <Chapter
        className="mt-[calc(var(--exm-section-y)*0.8)] border-t border-exm-line pt-[calc(var(--exm-section-y)*0.6)]"
        etykieta={d.b_etykieta} tytul={d.b_tytul} wstep={d.b_wstep} karty={d.b_karty}
        zamkniecie={d.b_nota} wyroznienie
      />
    </>
  );
}

// 7. Spokojny pas przejścia: zdjęcie na szerokość kontenera z krótkim credo.
const PAS_RATIO = { "21:9": "md:aspect-[21/9]", "16:9": "md:aspect-video", "3:2": "md:aspect-[3/2]" };

export function AboutPas({ d }) {
  if (!d.zdjecie?.url) return null;
  return (
    <figure className="relative overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line">
      <SafeImg img={d.zdjecie} sizes="(min-width: 1280px) 1200px, 100vw"
        className={`w-full aspect-[4/5] sm:aspect-[16/9] ${PAS_RATIO[d.proporcja] || PAS_RATIO["21:9"]}`} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/45 to-transparent" />
      {d.cytat && (
        <figcaption className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <p className="font-exm-serif text-[clamp(1.5rem,3.4vw,2.5rem)] leading-snug text-exm-ivory">{d.cytat}</p>
        </figcaption>
      )}
    </figure>
  );
}

// 8. Zakończenie: przycisk główny, drugorzędny, link tekstowy i mały odnośnik do książki.
export function AboutKoniec({ d, label }) {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-start md:gap-14">
      <div className="min-w-0">
        {(d.etykieta || label) && <p className="exm-eyebrow">{d.etykieta || label}</p>}
        {d.tytul && <h2 className="exm-h2 mt-4 whitespace-pre-line text-[clamp(1.75rem,3.4vw,2.6rem)]">{nbsp(d.tytul)}</h2>}
        <Rich html={d.tresc} className="mt-5 text-[17px] leading-relaxed text-exm-muted" />
        <Buttons list={d.przyciski} className="mt-8" />
        {d.link && d.link_etykieta && (
          <p className="mt-6">
            <Link to={d.link} className="btn-link">{d.link_etykieta}</Link>
          </p>
        )}
      </div>
      {d.ksiazka_link && (
        <Link
          to={d.ksiazka_link}
          className="group block min-w-0 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-3 transition-colors hover:border-exm-gold-line"
        >
          {d.ksiazka_zdjecie?.url && (
            <SafeImg img={d.ksiazka_zdjecie} sizes="(min-width: 768px) 300px, 100vw"
              className="aspect-[4/3] w-full rounded-[var(--exm-r-field)]" />
          )}
          <div className="p-3">
            <p className="technical text-[10px] text-exm-gold">KSIĄŻKA</p>
            <p className="mt-2 font-exm-serif text-[19px] leading-snug text-exm-ivory group-hover:text-exm-gold">{d.ksiazka_tytul}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-exm-muted">{d.ksiazka_opis || "Zobacz"}</p>
          </div>
        </Link>
      )}
    </div>
  );
}