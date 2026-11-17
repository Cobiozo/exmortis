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
    if (preview) return list.find((k) => k.id === previewId) || list[0] || null;
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

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-4" onClick={close}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exm-popup-title"
        className={`${boxClass(k)} max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain`}
        onClick={(e) => e.stopPropagation()}
      >
        <PopupCard k={k} close={close} clicked={clicked} copy={copy} copied={copied} closeRef={closeRef} />
      </div>
    </div>
  );
}
