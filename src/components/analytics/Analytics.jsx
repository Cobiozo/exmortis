import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import useSiteSettings from "@/lib/useSiteSettings";
import { setTrackSettings, applyConsent, trackPageView } from "@/lib/track";

// Wczytuje pomiar na stronie publicznej. W panelu, podglądzie i skanerze nie ładuje niczego.
export default function Analytics() {
  const loc = useLocation();
  const key = loc.pathname + loc.search;
  const pomiar = useSiteSettings()?.pomiar;
  const skip = loc.pathname.startsWith("/admin") || loc.pathname.startsWith("/skaner");

  useEffect(() => { setTrackSettings(pomiar); applyConsent(); }, [pomiar]);

  useEffect(() => {
    if (skip) return undefined;
    const onConsent = () => { applyConsent(); trackPageView(key); };
    window.addEventListener("exm:consent", onConsent);
    return () => window.removeEventListener("exm:consent", onConsent);
  }, [key, skip]);

  useEffect(() => { if (!skip) trackPageView(key); }, [key, skip, pomiar]);

  return null;
}