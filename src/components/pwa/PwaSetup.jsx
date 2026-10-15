import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import useSiteSettings from "@/lib/useSiteSettings";

// Identyfikator wersji = nazwa pliku wejściowego z index.html (zawiera hash z publikacji).
// Zmienia się przy każdym wdrożeniu, więc nowa wersja service workera zawsze się instaluje.
function buildId() {
  try {
    const el = document.querySelector('script[type="module"][src*="/assets/"]');
    const m = ((el && el.getAttribute("src")) || "").match(/assets\/(.+?)\.js$/);
    return m ? m[1] : "";
  } catch { return ""; }
}

// Rejestracja service workera (tylko produkcja, po zdarzeniu load), wyłącznik awaryjny
// oraz zapamiętanie, że ROZDROŻA/Minutnik były wcześniej otwarte (dla strony offline).
export default function PwaSetup() {
  const s = useSiteSettings();
  const { pathname } = useLocation();
  const offline = s?.aplikacja?.offline !== false;

  useEffect(() => {
    try {
      if (pathname.startsWith("/konto/rozdroza")) localStorage.setItem("exm_seen_rozdroza", "1");
      if (pathname.startsWith("/cisza")) localStorage.setItem("exm_seen_cisza", "1");
    } catch { /* brak dostępu do pamięci */ }
  }, [pathname]);

  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
    // Wyłącznik: zdejmujemy service workera i czyścimy jego cache.
    if (!offline) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      if (window.caches) caches.keys().then((ks) => ks.filter((k) => k.startsWith("exm-")).forEach((k) => caches.delete(k))).catch(() => {});
      return;
    }
    const reg = () => navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId())}`, { updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg, { once: true });
  }, [offline]);

  return null;
}