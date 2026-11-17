import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Copy, Check, ArrowRight } from "lucide-react";
import useSiteSettings from "@/lib/useSiteSettings";
import { useAuth } from "@/lib/AuthContext";
import { readConsent } from "@/components/legal/cookieStore";
import { SUPABASE_URL, ANON_KEY } from "@/api/exmSupabase";

// Kampanie popup (Panel → Ogłoszenia i popupy). Zasady:
// • najwyżej JEDEN popup w wizycie — pierwsza pasująca kampania (serwer sortuje po priorytecie);
// • nigdy w kasie, płatności, potwierdzeniach, dokumentach prawnych, panelu, teście i Ciszy;
// • najpierw wybór cookies, potem opóźnienie (i ewentualnie przewinięcie strony);
// • po zamknięciu / kliknięciu kampania milknie na ustawioną liczbę dni (0 = do końca kampanii);
// • liczniki (wyświetlenie / kliknięcie / zamknięcie) bez żadnych danych osobowych.
const SKIP = ["/admin", "/kasa", "/pobierz", "/powrot/platnosc", "/powrot/ankieta", "/test", "/login", "/register", "/forgot-password",
  "/reset-password", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie", "/umowa-powrot",
  "/bilet", "/karta", "/rezerwacja", "/zmiana-adresu", "/listy/", "/cisza", "/spotkania"];
const MEM = "exm_popup_k";
const DAY = 86400000;

const ownPath = (link) => {
  const s = String(link || "");
  if (s.startsWith("/")) return s;
  try { const u = new URL(s); return u.origin === window.location.origin || /(^|\.)exmortis\.pl$/.test(u.hostname) ? u.pathname + u.search + u.hash : null; } catch { return null; }
};
const norm = (p) => String(p || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
const readMem = () => { try { return JSON.parse(localStorage.getItem(MEM) || "{}") || {}; } catch { return {}; } };
const writeMem = (id, field) => {
  try { const m = readMem(); m[id] = { ...(m[id] || {}), [field]: Date.now() }; localStorage.setItem(MEM, JSON.stringify(m)); } catch { /* brak pamięci */ }
};
const flag = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
let shownThisVisit = false;
const visitDone = () => { if (shownThisVisit) return true; try { return sessionStorage.getItem("exm_popup_wizyta") === "1"; } catch { return false; } };
const markVisit = () => { shownThisVisit = true; try { sessionStorage.setItem("exm_popup_wizyta", "1"); } catch { /* brak pamięci */ } };

const hit = (id, typ) => {
  if (!SUPABASE_URL || !ANON_KEY || !id) return;
  fetch(`${SUPABASE_URL}/rest/v1/rpc/popup_hit`, {
    method: "POST", keepalive: true,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_kampania: id, p_typ: typ }),
  }).catch(() => {});
};

// Dawny pojedynczy popup (przed wdrożeniem kampanii po stronie serwera) → kształt kampanii.
const fromLegacy = (p) => p && ({
  id: "k-przeniesiony", rodzaj: p.kod ? "rabat" : "info", priorytet: 3, od: p.od, do: p.do, komu: p.komu, gdzie: "wszedzie", sciezki: [],
  tytul: p.tytul, tresc: p.tresc, przycisk_napis: p.przycisk_napis, akcja: p.przycisk_link ? "link" : "zamknij", href: p.przycisk_link,
  kod: p.kod, opoznienie: p.opoznienie, przewiniecie: 0, cisza_zamkniecie: 0, cisza_klik: 0,
});

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

export default function SitePopup() {
  const s = useSiteSettings();
  const { isAuthenticated } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef(null);
  const closeRef = useRef(null);
  const params = new URLSearchParams(search);
  const preview = params.has("popup");
  const previewId = params.get("popup") || "";

  const list = Array.isArray(s?.popups) ? s.popups : s?.popup ? [fromLegacy(s.popup)] : [];

  const pick = () => {
    if (!list.length) return null;
    if (preview) return list.find((k) => k.id === previewId) || (previewId ? null : list[0]) || null;
    if (visitDone()) return null;
    if (SKIP.some((x) => pathname.startsWith(x)) || pathname.endsWith("/dolacz")) return null;
    const now = Date.now() + (s?.offset || 0);
    const mem = readMem();
    const here = norm(pathname);
    return list.find((k) => {
      if (k.od && Date.parse(k.od) > now) return false;
      if (k.do && Date.parse(k.do) < now) return false;
      if (k.komu === "goscie" && isAuthenticated) return false;
      if (k.komu === "zalogowani" && !isAuthenticated) return false;
      if (k.bez_subskrybentow && flag("exm_sub")) return false;
      if (k.gdzie === "glowna" && here !== "/") return false;
      if (k.gdzie === "sklep" && !here.startsWith("/skarbiec")) return false;
      if (k.gdzie === "wybrane" && !(k.sciezki || []).some((p) => here === norm(p) || here.startsWith(`${norm(p)}/`))) return false;
      const target = ownPath(k.href);
      if (target && norm(target) === here) return false;
      // Cisza po zamknięciu / kliknięciu (0 dni = do końca kampanii).
      const m = mem[k.id] || {};
      if (m.z && (!k.cisza_zamkniecie || now - m.z < k.cisza_zamkniecie * DAY)) return false;
      if (m.k && (!k.cisza_klik || now - m.k < k.cisza_klik * DAY)) return false;
      // Kto zamknął dawny popup (przed kampaniami), nie dostaje go drugi raz.
      if (k.id === "k-przeniesiony" && flag("exm_popup")) return false;
      return true;
    }) || null;
  };
  const cand = open ? null : pick();

  useEffect(() => {
    if (!cand) return undefined;
    let timer; let ready = false; let scrolled = !(cand.przewiniecie > 0) || preview;
    const show = () => { if (ready && scrolled) { markVisit(); setOpen(cand); if (!preview) hit(cand.id, "wysw"); } };
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0 || (window.scrollY / h) * 100 >= cand.przewiniecie) { scrolled = true; window.removeEventListener("scroll", onScroll); show(); }
    };
    const start = () => { timer = setTimeout(() => { ready = true; show(); }, preview ? 300 : (Number(cand.opoznienie) || 0) * 1000); };
    if (!scrolled) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }
    const onConsent = () => { window.removeEventListener("exm:consent", onConsent); start(); };
    if (readConsent() || preview) start(); else window.addEventListener("exm:consent", onConsent);
    return () => { clearTimeout(timer); window.removeEventListener("scroll", onScroll); window.removeEventListener("exm:consent", onConsent); };
  }, [cand?.id, pathname, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (open && !preview) { writeMem(open.id, "z"); hit(open.id, "zamk"); }
    setOpen(null);
  };
  const clicked = () => {
    if (open && !preview) { writeMem(open.id, "k"); hit(open.id, "klik"); }
    if (open?.kod) { try { sessionStorage.setItem("exm_kod", open.kod); } catch { /* brak pamięci */ } }
    setOpen(null);
  };

  // Klawiatura: Escape zamyka, Tab krąży wewnątrz okna, fokus wraca tam, gdzie był.
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const f = [...boxRef.current.querySelectorAll("a[href],button:not([disabled])")];
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (before?.focus) before.focus(); };
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const k = open;
  const copy = async () => {
    try { await navigator.clipboard.writeText(k.kod); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* brak schowka */ }
    if (!preview) hit(k.id, "klik");
  };

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
  const special = k.rodzaj === "rabat";
  const tag = k.etykieta || (k.rodzaj === "spotkanie" ? (ev?.bezplatne ? "Spotkanie · bezpłatne" : "Spotkanie") : k.rodzaj === "produkt" ? "Sklep" : k.rodzaj === "listy" ? "Listy Powrotu" : "");

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-4" onClick={close}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exm-popup-title"
        className={`relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border shadow-2xl bg-[#0A0A0B] ${special ? "border-[#C9A24A]/70 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,74,.14),#0A0A0B_60%)]" : k.rodzaj === "info" ? "border-white/15" : "border-[#C9A24A]/50"}`}
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}
