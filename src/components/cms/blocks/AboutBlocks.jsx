import React, { useState } from "react";
import { Play } from "lucide-react";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { Link } from "react-router-dom";
import SafeImg from "../SafeImg";
import { Buttons, Rich, SectionHead } from "../parts";
import { ratioClass } from "../ratios";
import { embed } from "./MediaBlocks";
import { nbsp } from "@/lib/nbsp";

// Strona „O mnie” — etap 7 (18.11.2026). Sekcje w systemie wizualnym marki: tokeny --exm-*,
// wąska kolumna tekstu (≤ 720 px), odstępy wyłącznie z --exm-section-y, naprzemienne tła bg/surface.
// Treść pochodzi z bloków CMS (defaults/aboutDefault.js) — komponenty nie zawierają zdań autorskich.

// Piosenka jako zwarta karta (25.11.2026): tytuł, podpis i przycisk odtwarzania. Odtwarzacz YouTube
// ładuje się dopiero po kliknięciu (wcześniej nic nie idzie do YouTube) i ma szerokość karty.
function Song({ url, tytul, podpis }) {
  const e = embed(url);
  const consent = useMarketingConsent();
  const [on, setOn] = useState(false);
  if (!e) return null;
  if (on) {
    const src = e.src ? `${e.src}${e.src.includes("?") ? "&" : "?"}autoplay=1` : null;
    return (
      <figure className="min-w-0">
        <div className="aspect-video w-full overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg">
          {src
            ? <iframe src={src} title={tytul || podpis || "Piosenka"} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            : <video src={e.file} controls autoPlay playsInline className="h-full w-full object-contain" />}
        </div>
        {podpis && <figcaption className="mt-2 text-[13px] leading-relaxed text-exm-muted">{podpis}</figcaption>}
      </figure>
    );
  }
  return (
    <div className="flex min-w-0 flex-col">
      <button type="button" onClick={() => setOn(true)} aria-label={`Odtwórz piosenkę ${tytul || ""}`.trim()}
        className="group flex w-full flex-1 items-center gap-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg/60 p-4 text-left transition-colors hover:border-exm-gold-line">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-exm-gold text-exm-bg transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="technical block text-[10px] text-exm-gold">PIOSENKA</span>
          {tytul && <span className="mt-1 block truncate font-exm-serif text-[19px] leading-snug text-exm-ivory">{tytul}</span>}
          {podpis && podpis !== tytul && <span className="mt-0.5 block text-[13px] leading-snug text-exm-muted">{podpis}</span>}
        </span>
      </button>
      {!consent && e.src && <p className="mt-2 text-[11px] leading-snug text-exm-muted">Odtwarzacz YouTube wczyta się po kliknięciu (adres IP, pliki cookies).</p>}
    </div>
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

// 2. Historia przełomu (układ 25.11.2026): rozdziały w kolumnie tekstu, a na komputerze obok — przyklejona
//    kolumna ze zdjęciem z dawnego życia i piosenką „exmortis”. Na telefonie zdjęcie i piosenka stoją przy rozdziałach.
export function AboutHistoria({ d, label }) {
  const rozdzialy = d.rozdzialy || [];
  const po = Number(d.piosenka_po) || 0;
  const zdjecia = rozdzialy.filter((r) => r.zdjecie?.url);
  const piosenka = d.piosenka_url ? <Song url={d.piosenka_url} tytul={d.piosenka_tytul} podpis={d.piosenka_podpis} /> : null;
  const foto = (r, cls = "") => (
    <figure className={cls}>
      <div className="aspect-[4/5] overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2">
        <SafeImg img={r.zdjecie} sizes="(min-width: 768px) 300px, 60vw" className="h-full w-full" />
      </div>
      {r.podpis && <figcaption className="technical mt-3 text-[10px] text-exm-muted">{r.podpis}</figcaption>}
    </figure>
  );
  return (
    <>
      {(d.etykieta || label) && <p className="exm-eyebrow">{d.etykieta || label}</p>}
      <div className="mt-8 grid gap-12 md:grid-cols-[minmax(0,1fr)_280px] md:gap-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
        <div className="min-w-0 max-w-[var(--exm-container-narrow)]">
          {rozdzialy.map((r, i) => (
            <div key={i} className={i ? "mt-10" : ""}>
              {r.tytul && <h2 className="exm-h3 text-[clamp(1.25rem,2.4vw,1.6rem)]">{r.tytul}</h2>}
              <Rich html={r.tresc} className="mt-3 text-[17px] leading-relaxed text-exm-muted" />
              {r.zdjecie?.url && foto(r, "mt-6 w-[62%] max-w-[260px] md:hidden")}
              {po === i + 1 && piosenka && <div className="mt-6 md:hidden">{piosenka}</div>}
            </div>
          ))}
        </div>
        {(zdjecia.length > 0 || piosenka) && (
          <aside className="hidden md:block">
            <div className="space-y-6 md:sticky md:top-[calc(var(--exm-header-h,72px)+24px)]">
              {zdjecia.map((r, i) => <React.Fragment key={i}>{foto(r)}</React.Fragment>)}
              {piosenka}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

// 3 i 4. Zdjęcie obok tekstu (układ 25.11.2026). Zdjęcie zachowuje swój kadr (bez ucinania głów): szerokość
//    wynika z proporcji, a nie z kolumny. Piosenki stoją w kolumnie tekstu jako zwarte karty.
const ZD_RATIO = { "1:1": 1, "4:5": 0.8, "2:3": 2 / 3, "3:2": 1.5, "16:9": 16 / 9, "4:3": 4 / 3, "21:9": 21 / 9 };
const ZD_CLASS = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "2:3": "aspect-[2/3]", "3:2": "aspect-[3/2]", "16:9": "aspect-video", "4:3": "aspect-[4/3]", "21:9": "aspect-[21/9]" };

export function AboutZdjecie({ d, label }) {
  const prawo = d.strona === "prawo";
  const kadr = d.zdjecie?.kadr && ZD_CLASS[d.zdjecie.kadr] ? d.zdjecie.kadr : d.proporcja && ZD_CLASS[d.proporcja] ? d.proporcja : "4:5";
  const r = ZD_RATIO[kadr];
  const pion = r < 1;
  const songs = [
    d.piosenka_url && { url: d.piosenka_url, tytul: d.piosenka_tytul, podpis: d.piosenka_podpis },
    d.piosenka2_url && { url: d.piosenka2_url, tytul: d.piosenka2_tytul, podpis: d.piosenka2_podpis },
  ].filter(Boolean);
  const cols = pion
    ? (prawo ? "md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]" : "md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]")
    : "md:grid-cols-2";
  return (
    <div className={`grid items-center gap-8 md:gap-14 lg:gap-16 ${cols}`}>
      <figure className={`mx-auto w-full ${pion ? "max-w-[380px]" : ""} ${prawo ? "md:order-2" : ""}`}
        style={{ maxWidth: pion ? undefined : `min(100%, calc(560px * ${r.toFixed(4)}))` }}>
        {d.zdjecie?.url ? (
          <SafeImg img={d.zdjecie} sizes={pion ? "(min-width: 768px) 380px, 90vw" : "(min-width: 768px) 45vw, 100vw"}
            className={`w-full ${ZD_CLASS[kadr]} rounded-[var(--exm-r-card)] border border-exm-line`} />
        ) : (
          <div className={`w-full ${ZD_CLASS[kadr]} rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2`} />
        )}
        {d.podpis && <figcaption className="mt-3 text-[12px] leading-relaxed text-exm-muted">{d.podpis}</figcaption>}
      </figure>
      <div className={`min-w-0 ${prawo ? "md:order-1" : ""}`}>
        {(d.etykieta || label) && <p className="exm-eyebrow">{d.etykieta || label}</p>}
        {d.tytul && <h2 className="exm-h2 mt-4 whitespace-pre-line text-[clamp(1.5rem,2.6vw,2rem)]">{nbsp(d.tytul)}</h2>}
        <Rich html={d.tresc} className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-exm-muted" />
        {(d.piosenka_wstep || songs.length > 0) && (
          <div className="mt-8 border-t border-exm-line pt-6">
            {d.piosenka_wstep && <p className="max-w-[60ch] text-[15px] leading-relaxed text-exm-muted">{nbsp(d.piosenka_wstep)}</p>}
            <div className={`mt-4 grid gap-3 ${songs.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {songs.map((x, i) => <Song key={i} {...x} />)}
            </div>
          </div>
        )}
      </div>
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