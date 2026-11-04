import React, { useState } from "react";
import { Play } from "lucide-react";
import useMarketingConsent from "@/lib/useMarketingConsent";
import { openCookieSettings } from "@/components/legal/cookieStore";

// Osadzony odtwarzacz zewnętrzny (YouTube, Spotify, Vimeo). Dopóki nie ma zgody na treści zewnętrzne
// albo osoba nie kliknie „Załaduj”, nie ładuje się nic z serwerów dostawcy (art. 399 Pke).
// children: funkcja zwracająca iframe — wywoływana dopiero po zgodzie lub kliknięciu.
export default function ExternalEmbed({ provider = "YouTube", what = "film", className = "", children }) {
  const consent = useMarketingConsent();
  const [clicked, setClicked] = useState(false);
  if (consent || clicked) return children();
  return (
    <div className={`${className} bg-[#0A0A0B] border hairline flex flex-col items-center justify-center text-center gap-4 p-6`}>
      <button type="button" onClick={() => setClicked(true)} className="btn-ghost inline-flex items-center gap-2 min-h-11">
        <Play className="h-4 w-4" /> ZAŁADUJ {what.toUpperCase()} ({provider.toUpperCase()})
      </button>
      <p className="text-xs text-foreground/60 leading-relaxed max-w-sm">
        Po kliknięciu {provider} otrzyma Twój adres IP i może zapisać pliki cookies.{" "}
        <button type="button" onClick={openCookieSettings} className="underline hover:gold-text">Ustawienia cookies</button>
      </p>
    </div>
  );
}
