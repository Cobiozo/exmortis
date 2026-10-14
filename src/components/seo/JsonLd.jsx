import { useEffect } from "react";

// Dane strukturalne (JSON-LD) dla Google: jeden skrypt na element, wstawiany na czas pobytu
// na stronie i usuwany przy zmianie adresu (wzorzec z EpisodeSeo.jsx).
export default function JsonLd({ data }) {
  const json = JSON.stringify((Array.isArray(data) ? data : [data]).filter(Boolean));
  useEffect(() => {
    if (!json || json === "[]") return;
    const scripts = JSON.parse(json).map((item) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.text = JSON.stringify(item);
      document.head.appendChild(s);
      return s;
    });
    return () => scripts.forEach((s) => s.remove());
  }, [json]);
  return null;
}