import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Copy, Check, ArrowRight } from "lucide-react";
import useSiteSettings from "@/lib/useSiteSettings";
import { useAuth } from "@/lib/AuthContext";
import { readConsent } from "@/components/legal/cookieStore";

const KEY = "exm_popup";
// Popup nie przeszkadza w zakupie, płatności, teście, logowaniu ani w dokumentach prawnych.
const SKIP = ["/admin", "/kasa", "/powrot/platnosc", "/powrot/ankieta", "/test", "/login", "/register", "/forgot-password",
  "/reset-password", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie", "/umowa-powrot",
  "/bilet", "/karta", "/rezerwacja", "/zmiana-adresu", "/listy/", "/cisza", "/spotkania"];

// Link z popupu na adres tej strony (https://exmortis.pl/…) traktujemy jak wewnętrzny: ścieżka zamiast pełnego adresu.
const ownPath = (link) => {
  const s = String(link || "");
  if (s.startsWith("/")) return s;
  try { const u = new URL(s); return u.origin === window.location.origin || /(^|\.)exmortis\.pl$/.test(u.hostname) ? u.pathname + u.search + u.hash : null; } catch { return null; }
};

const seen = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const markSeen = (v) => { try { localStorage.setItem(KEY, String(v)); } catch { /* brak pamięci */ } };
// Zamknięty w tej wizycie — nie wraca, nawet w podglądzie i gdy przeglądarka nie zapisuje localStorage.
let closedThisVisit = false;

// Popup na stronie (Panel → Ogłoszenia → Popup na stronie): raz na odwiedzającego dla każdej wersji,
// po wyborze cookies i po kilku sekundach — nigdy w kasie, płatności ani w teście.
export default function SitePopup() {
  const s = useSiteSettings();
  const { isAuthenticated } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);
  const p = s?.popup;
  const preview = new URLSearchParams(search).has("popup");

  const eligible = (() => {
    if (!p || closedThisVisit) return false;
    if (preview) return true;
    if (SKIP.some((x) => pathname.startsWith(x)) || pathname.endsWith("/dolacz")) return false;
    // Nie na stronie, do której popup prowadzi (np. zapis na to samo spotkanie).
    const target = ownPath(p.przycisk_link);
    if (target && target.split(/[?#]/)[0].replace(/\/+$/, "") === pathname.replace(/\/+$/, "")) return false;
    const now = Date.now() + (s?.offset || 0);
    if (p.od && Date.parse(p.od) > now) return false;
    if (p.do && Date.parse(p.do) < now) return false;
    if (p.komu === "goscie" && isAuthenticated) return false;
    if (p.komu === "zalogowani" && !isAuthenticated) return false;
    return seen() !== String(p.wersja);
  })();

  useEffect(() => {
    if (!eligible || open) return undefined;
    let timer;
    const start = () => { timer = setTimeout(() => setOpen(true), preview ? 300 : (Number(p.opoznienie) || 0) * 1000); };
    // Najpierw wybór cookies — dwa okna naraz to za dużo.
    if (readConsent() || preview) { start(); return () => clearTimeout(timer); }
    const onConsent = () => { window.removeEventListener("exm:consent", onConsent); start(); };
    window.addEventListener("exm:consent", onConsent);
    return () => { clearTimeout(timer); window.removeEventListener("exm:consent", onConsent); };
  }, [eligible, open, p?.wersja, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { closedThisVisit = true; if (!preview && p) markSeen(p.wersja); setOpen(false); };

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !p) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(p.kod); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* brak schowka */ }
  };
  const inner = ownPath(p.przycisk_link);
  const external = !inner && /^https:\/\//.test(p.przycisk_link || "");
  const btnCls = "btn-relic w-full sm:w-auto";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exm-popup-title"
        className="relative w-full max-w-md bg-[#0A0A0B] border border-[#C9A24A]/50 p-7 sm:p-8 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} onClick={close} aria-label="Zamknij" className="absolute top-3 right-3 p-2 text-foreground/50 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        {p.tytul && <h2 id="exm-popup-title" className="relic-heading text-2xl sm:text-3xl gold-text pr-8">{p.tytul}</h2>}
        {p.tresc && <p className="text-foreground/75 leading-relaxed whitespace-pre-line">{p.tresc}</p>}
        {p.kod && (
          <button onClick={copy} className="w-full flex items-center justify-between gap-3 border border-dashed border-[#C9A24A]/60 px-4 py-3 hover:bg-[#C9A24A]/5" aria-label={`Skopiuj kod ${p.kod}`}>
            <span className="font-mono text-lg tracking-widest gold-text">{p.kod}</span>
            <span className="technical text-[10px] text-foreground/60 flex items-center gap-1.5">
              {copied ? <><Check className="h-3.5 w-3.5" /> SKOPIOWANO</> : <><Copy className="h-3.5 w-3.5" /> KOPIUJ</>}
            </span>
          </button>
        )}
        {p.przycisk_napis && p.przycisk_link && (
          external
            ? <a href={p.przycisk_link} target="_blank" rel="noopener noreferrer" onClick={close} className={btnCls}>{p.przycisk_napis.toUpperCase()} <ArrowRight className="h-4 w-4" /></a>
            : <Link to={inner || p.przycisk_link} onClick={close} className={btnCls}>{p.przycisk_napis.toUpperCase()} <ArrowRight className="h-4 w-4" /></Link>
        )}
      </div>
    </div>
  );
}
