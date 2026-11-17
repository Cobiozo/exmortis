import React from "react";
import { Link } from "react-router-dom";
import { X, Copy, Check, ArrowRight } from "lucide-react";

// Wygląd popupu (cztery szablony: produkt, spotkanie, rabat, ogłoszenie / Listy Powrotu).
// Używany na stronie (SitePopup) i w podglądzie w panelu — ten sam wygląd w obu miejscach.
export const ownPath = (link) => {
  const s = String(link || "");
  if (s.startsWith("/")) return s;
  try { const u = new URL(s); return u.origin === window.location.origin || /(^|\.)exmortis\.pl$/.test(u.hostname) ? u.pathname + u.search + u.hash : null; } catch { return null; }
};
const zl = (n) => `${Number(n).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const MON = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];
const dateParts = (iso) => {
  const d = new Date(iso);
  const tz = { timeZone: "Europe/Warsaw" };
  return {
    day: d.toLocaleDateString("pl-PL", { ...tz, day: "numeric" }),
    mon: MON[Number(d.toLocaleDateString("en-US", { ...tz, month: "numeric" })) - 1],
    line: d.toLocaleString("pl-PL", { ...tz, weekday: "long", hour: "2-digit", minute: "2-digit" }),
  };
};
export const boxClass = (k) => `relative w-full max-w-md rounded-2xl border shadow-2xl bg-[#0A0A0B] ${k.rodzaj === "rabat" ? "border-[#C9A24A]/70 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,74,.14),#0A0A0B_60%)]" : k.rodzaj === "info" ? "border-white/15" : "border-[#C9A24A]/50"}`;

export default function PopupCard({ k, close, clicked, copy, copied = false, closeRef = null, static: still = false }) {
  const href = k.href || "";
  const inner = ownPath(href);
  const external = !inner && /^https:\/\//.test(href);
  const label = k.przycisk_napis || (k.akcja === "spotkanie" ? "Zarezerwuj miejsce" : k.akcja === "listy" ? "Zapisz się na Listy Powrotu" : k.akcja === "zamknij" ? "Rozumiem" : "Zobacz");
  const primary = "inline-flex w-full items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-[#C9A24A] text-[#0A0A0B] font-semibold text-sm hover:bg-[#E2C27A] transition-colors";
  const cta = (() => {
    if (k.akcja === "brak") return null;
    if (k.akcja === "kopiuj") return null;
    if (k.akcja === "zamknij" || !href) return <button type="button" onClick={close} className={primary}>{label}</button>;
    if (external) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={clicked} className={primary}>{label} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>;
    return <Link to={inner || href} onClick={clicked} className={primary}>{label} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
  })();
  const prod = k.produkt;
  const ev = k.spotkanie;
  const tag = k.etykieta || (k.rodzaj === "spotkanie" ? (ev?.bezplatne ? "Spotkanie · bezpłatne" : "Spotkanie") : k.rodzaj === "produkt" ? "Sklep" : k.rodzaj === "listy" ? "Listy Powrotu" : "");

  const Btn = still ? "span" : Link;
  return (
    <>
        <button ref={closeRef} type="button" onClick={close} aria-label="Zamknij" className="absolute right-2 top-2 z-10 h-10 w-10 inline-flex items-center justify-center rounded-lg bg-[#0A0A0B]/60 text-foreground/60 hover:text-foreground">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {k.rodzaj === "produkt" && prod?.obraz && (
          <img src={prod.obraz} alt="" className="w-full aspect-[16/9] object-cover rounded-t-2xl" loading="lazy" />
        )}
        <div className="p-5 sm:p-6 space-y-3">
          {tag && <p className="technical text-[10px] tracking-[.14em] gold-text uppercase">{tag}</p>}
          {k.rodzaj === "spotkanie" && ev ? (
            <div className="flex items-center gap-3.5 pr-8">
              <span className="w-16 flex-none text-center border border-[#C9A24A]/50 rounded-xl py-1.5 flex flex-col">
                <span className="relic-heading text-3xl leading-none">{dateParts(ev.start).day}</span>
                <span className="technical text-[10px] tracking-[.12em] gold-text">{dateParts(ev.start).mon}</span>
              </span>
              <span className="flex flex-col min-w-0">
                <h2 id="exm-popup-title" className="relic-heading normal-case text-2xl leading-tight text-[#F1EDE3]">{k.tytul || ev.tytul}</h2>
                <span className="text-sm text-foreground/60">{dateParts(ev.start).line}{ev.format ? ` · ${String(ev.format).toLowerCase()}` : ""}</span>
              </span>
            </div>
          ) : (
            <h2 id="exm-popup-title" className="relic-heading normal-case text-2xl sm:text-[1.7rem] leading-tight text-[#F1EDE3] pr-8">{k.tytul || prod?.nazwa}</h2>
          )}
          {k.tresc && <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{k.tresc}</p>}
          {prod && (k.rodzaj === "produkt" || k.rodzaj === "rabat") && (
            <p className="flex items-baseline gap-2.5">
              <span className="relic-heading text-[1.7rem] text-[#F1EDE3]">{zl(prod.cena_po ?? prod.cena)}</span>
              {(prod.cena_po != null ? prod.cena : prod.cena_regularna) > (prod.cena_po ?? prod.cena) && (
                <span className="text-sm text-foreground/50 line-through">{zl(prod.cena_po != null ? prod.cena : prod.cena_regularna)}</span>
              )}
            </p>
          )}
          {k.kod && (
            <button type="button" onClick={copy} className="w-full min-h-[44px] flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#C9A24A]/70 px-4 hover:bg-[#C9A24A]/5" aria-label={`Skopiuj kod ${k.kod}`}>
              <span className="font-mono text-base tracking-[.25em] gold-text">{k.kod}</span>
              <span className="technical text-[10px] text-foreground/60 flex items-center gap-1.5">
                {copied ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> SKOPIOWANO</> : <><Copy className="h-3.5 w-3.5" aria-hidden="true" /> KOPIUJ</>}
              </span>
            </button>
          )}
          {cta}
          {k.kod && cta && k.kod_dla === "subskrybenci" && <p className="text-[11px] text-foreground/50 text-center">Kod działa z adresem e-mail zapisanym na Listy Powrotu.</p>}
          {k.kod && cta && k.kod_dla === "konto" && <p className="text-[11px] text-foreground/50 text-center">Kod działa po zalogowaniu na konto.</p>}
          {k.kod && cta && !k.kod_dla && inner && <p className="text-[11px] text-foreground/50 text-center">Kod wpisze się w kasie sam.</p>}
          {k.rodzaj === "spotkanie" && cta && <p className="text-[11px] text-foreground/50 text-center">Zapis zajmuje chwilę · link przyjdzie e-mailem.</p>}
        </div>
    </>
  );
}
