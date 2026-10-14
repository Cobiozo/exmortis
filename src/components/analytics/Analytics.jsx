import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import useSiteSettings from "@/lib/useSiteSettings";
import { setTrackSettings, applyConsent, trackPageView } from "@/lib/track";

// Wczytuje pomiar na stronie publicznej. W panelu, podglądzie i skanerze nie ładuje niczego.
export default function Analytics() {
  const loc = useLocation();
  const key = loc.pathname + loc.search;
  const pomiar = useSiteSettings()?.pomiar;
  // Bez pomiaru: panel, skaner i strony z prywatnym kluczem w adresie (wypis, potwierdzenie, zmiana adresu,
  // rezerwacja, karta, bilet, dołączenie do spotkania, konto) — klucz nie może trafić do narzędzi zewnętrznych.
  const skip = /^\/(admin|skaner|listy\/|zmiana-adresu|rezerwacja\/|karta|bilet|konto)/.test(loc.pathname) || /\/dolacz\/?$/.test(loc.pathname);

  useEffect(() => { setTrackSettings(pomiar); if (!skip) applyConsent(); }, [pomiar, skip]);

  useEffect(() => {
    if (skip) return undefined;
    const onConsent = () => { applyConsent(); trackPageView(key); };
    window.addEventListener("exm:consent", onConsent);
    return () => window.removeEventListener("exm:consent", onConsent);
  }, [key, skip]);

  useEffect(() => { if (!skip) trackPageView(key); }, [key, skip, pomiar]);

  return null;
}