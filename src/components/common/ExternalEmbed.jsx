import React, { useState } from "react";
import { Play } from "lucide-react";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { openCookieSettings } from "@/components/legal/cookieStore";

// Osadzony odtwarzacz zewnętrzny (YouTube, Spotify, Vimeo). Dopóki nie ma zgody na treści zewnętrzne
// albo osoba nie kliknie „Załaduj”, nie ładuje się nic z serwerów dostawcy (art. 399 Pke).
// title/cover: spokojna okładka przed zgodą (np. piosenka); bez nich dotychczasowy mały panel.
export default function ExternalEmbed({ provider = "YouTube", what = "film", title, cover, className = "", children }) {
  const consent = useMarketingConsent();
  const [clicked, setClicked] = useState(false);
  if (consent || clicked) return children();

  const load = (
    <button type="button" onClick={() => setClicked(true)} className="btn-ghost inline-flex items-center gap-2 min-h-11">
      <Play className="h-4 w-4" aria-hidden="true" /> Załaduj {what} ({provider})
    </button>
  );
  const note = (
    <p className="max-w-sm text-xs leading-relaxed text-foreground/60">
      Po kliknięciu {provider} otrzyma Twój adres IP i może zapisać pliki cookies.{" "}
      <button type="button" onClick={openCookieSettings} className="underline hover:gold-text">Ustawienia cookies</button>
    </p>
  );

  if (title || cover?.url) {
    return (
      <div className={`${className} relative overflow-hidden bg-[#0F0F10]`}>
        {cover?.url && (
          <img src={cover.url} alt={cover.alt || ""} loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/55 to-transparent" />
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
          {title && <p className="font-exm-serif text-xl leading-snug text-exm-ivory md:text-2xl">{title}</p>}
          {load}
          {note}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-[#0A0A0B] border hairline flex flex-col items-center justify-center text-center gap-4 p-6`}>
      {load}
      {note}
    </div>
  );
}