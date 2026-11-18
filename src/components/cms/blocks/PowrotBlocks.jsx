import React from "react";
import { Lock, MessageCircle, CalendarClock, PauseCircle, BookOpen, ShieldCheck } from "lucide-react";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import { Buttons, Rich } from "../parts";
import SafetyBox from "./SafetyBox";
import { POWROT, POWROT_HOW_ROWS, POWROT_INCLUDES } from "@/lib/powrotOffer";

// Sekcje strony POWRÓT (etap 3, 18.11.2026). Treść przychodzi z bloków CMS (edytowalna w „Treści stron”),
// a parametry programu (cena, sesje, czas, pojemność, start) wyłącznie ze stałych powrotOffer.js.

// Dwie kolumny (dla kogo / nie dla kogo) + zwarta ramka bezpieczeństwa pod nimi.
export function PowrotColumns({ d, label }) {
  return (
    <>
      <SectionHeader eyebrow={d.etykieta || label} title={d.tytul} />
      <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
        {[1, 2].map((n) => (
          <div key={n} className="min-w-0 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
            <h3 className="exm-h3 text-[clamp(1.25rem,2vw,1.5rem)]">{d[`kolumna${n}_tytul`]}</h3>
            <Rich html={d[`kolumna${n}_tresc`]} className="mt-4 text-[16px] leading-relaxed text-exm-muted" />
          </div>
        ))}
      </div>
      {d.ramka_tresc && (
        <div className="mt-8">
          <SafetyBox d={{ tytul: d.ramka_tytul, tresc: d.ramka_tresc, rozmiar: "mala" }} />
        </div>
      )}
    </>
  );
}

// Jeden rozdział: wstęp, pas meta (ze stałych), cztery etapy jako pozioma mapa, oś przebiegu.
export function PowrotProcess({ d, label }) {
  const stages = d.etapy || [];
  const steps = d.przebieg || [];
  return (
    <>
      <SectionHeader eyebrow={d.etykieta || label} title={d.tytul} />
      {d.tresc && <Rich html={d.tresc} className="mt-6 max-w-[var(--exm-container-narrow)] text-[17px] leading-relaxed text-exm-muted" />}

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-line sm:grid-cols-4">
        {POWROT_HOW_ROWS.map((r) => (
          <div key={r.label} className="min-w-0 bg-exm-surface p-4 md:p-5">
            <dt className="technical text-[10px] text-exm-gold">{r.label}</dt>
            <dd className="mt-1 text-[15px] leading-snug text-exm-ivory">{r.value}</dd>
          </div>
        ))}
      </dl>

      {d.etapy_intro && <p className="mt-10 max-w-[70ch] text-[15px] leading-relaxed text-exm-muted">{d.etapy_intro}</p>}

      <ol className="relative mt-6 grid gap-8 md:grid-cols-4 md:gap-6">
        <span aria-hidden="true" className="absolute left-[13px] top-3 bottom-3 w-px bg-exm-line-strong md:hidden" />
        <span aria-hidden="true" className="absolute left-[13px] right-[13px] top-[13px] hidden h-px bg-exm-line-strong md:block" />
        {stages.map((s, i) => (
          <li key={i} className="relative min-w-0 pl-10 md:pl-0">
            <span aria-hidden="true" className="absolute left-0 top-0 grid h-[27px] w-[27px] place-items-center rounded-full border border-exm-gold-line bg-exm-bg text-[10px] font-medium text-exm-gold md:static md:mb-5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="exm-h3">{s.tytul}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{s.opis}</p>
          </li>
        ))}
      </ol>

      {steps.length > 0 && (
        <ol className="mt-12 grid gap-6 border-t border-exm-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="min-w-0">
              <p className="technical text-[10px] text-exm-gold">{String(i + 1).padStart(2, "0")}</p>
              <h4 className="exm-h3 mt-2 text-[18px]">{s.tytul}</h4>
              <p className="mt-2 text-[14px] leading-relaxed text-exm-muted">{s.opis}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// Inwestycja: jedna wyróżniona karta — cena, zakres, raty, limit miejsc, start, oba przyciski.
export function PowrotInvestment({ d, label }) {
  return (
    <>
      <SectionHeader eyebrow={d.etykieta || label} title={d.tytul} />
      <div className="mt-8 md:mt-10">
        <BrandCard variant="usługa" label="POWRÓT · MENTORING 1:1" className="!border-exm-gold-line !bg-exm-surface-2" action={<Buttons list={d.przyciski} />}>
          <p className="font-exm-serif text-4xl leading-none text-exm-gold md:text-5xl">{POWROT.priceText}</p>
          <ul className="mt-5 space-y-2 text-[15px] text-exm-muted">
            {POWROT_INCLUDES.map((t) => (
              <li key={t} className="flex gap-2.5 leading-relaxed">
                <span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-exm-gold" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
          <Rich html={d.tresc} className="mt-5 text-[15px] leading-relaxed text-exm-muted" />
        </BrandCard>
      </div>
    </>
  );
}

// Zasady współpracy: siatka dwóch kolumn z ikonami i linkiem do Umowy POWRÓT.
const RULE_ICONS = [Lock, MessageCircle, CalendarClock, PauseCircle, BookOpen, ShieldCheck];

export function PowrotRules({ d, label }) {
  const items = d.elementy || [];
  return (
    <>
      <SectionHeader
        eyebrow={d.etykieta || label}
        title={d.tytul}
        action={d.link_etykieta && d.link ? <BrandButton variant="link" to={d.link}>{d.link_etykieta}</BrandButton> : null}
      />
      <ul className="mt-10 grid gap-7 md:mt-12 md:grid-cols-2 md:gap-x-12 md:gap-y-8">
        {items.map((it, i) => {
          const Icon = RULE_ICONS[i % RULE_ICONS.length];
          return (
            <li key={i} className="flex min-w-0 gap-4">
              <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-exm-gold" />
              <div className="min-w-0">
                <h3 className="exm-h3 text-[18px]">{it.tytul}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-exm-muted">{it.opis}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Zakończenie: spokojna alternatywa (otwarte spotkanie) obok karty Rozmowy na progu, na końcu cytat.
export function PowrotClosing({ d }) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex min-w-0 flex-col">
          <h2 className="exm-h2">{d.lewa_tytul}</h2>
          <Rich html={d.lewa_tresc} className="mt-4 text-[17px] leading-relaxed text-exm-muted" />
          <Buttons list={d.lewa_przyciski} className="mt-6" />
        </div>
        <div className="min-w-0 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
          {d.prawa_etykieta && <p className="exm-eyebrow">{d.prawa_etykieta}</p>}
          {d.prawa_tytul && <h2 className="exm-h2 mt-3 text-[clamp(1.5rem,2.6vw,2rem)]">{d.prawa_tytul}</h2>}
          <Rich html={d.prawa_tresc} className="mt-4 text-[15px] leading-relaxed text-exm-muted" />
          <Buttons list={d.prawa_przyciski} className="mt-6" />
        </div>
      </div>
      {d.cytat && (
        <figure className="mt-12 border-t border-exm-line pt-8 text-center">
          <blockquote className="font-exm-serif text-2xl leading-snug text-exm-ivory md:text-3xl">{d.cytat}</blockquote>
          {d.podpis && <figcaption className="technical mt-3 text-[10px] text-exm-gold">{d.podpis}</figcaption>}
        </figure>
      )}
    </>
  );
}