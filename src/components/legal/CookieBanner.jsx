import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BANNER_TEXT } from "@/content/legal/cookies";
import { readConsent, saveConsent } from "./cookieStore";
import CookieSettings from "./CookieSettings";

// Pasek zgód na dole strony + panel ustawień. Bez zgody nie ładujemy skryptów analitycznych ani marketingowych.
export default function CookieBanner() {
  const [show, setShow] = useState(() => !readConsent());
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    const open = () => { setShow(true); setSettings(true); };
    window.addEventListener("exm:cookies", open);
    return () => window.removeEventListener("exm:cookies", open);
  }, []);
  if (!show) return null;
  const done = (a, m) => { saveConsent(a, m); setShow(false); setSettings(false); };
  const btn = "btn-ghost !px-4 !py-2 text-[10px] flex-1 sm:flex-none";

  return (
    <div role="dialog" aria-label="Ustawienia cookies" className="fixed bottom-0 inset-x-0 z-[90] bg-[#0F0F10] border-t border-[#3D3D3F] px-5 py-4">
      <div className="mx-auto max-w-[1100px]">
        {settings ? <CookieSettings onSave={done} /> : (
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <p className="text-xs text-foreground/70 leading-relaxed flex-1">{BANNER_TEXT} <Link to="/polityka-cookies" className="underline">Polityka cookies</Link></p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => done(true, true)} className={btn}>Akceptuję wszystkie</button>
              <button onClick={() => done(false, false)} className={btn}>Odrzucam</button>
              <button onClick={() => setSettings(true)} className={btn}>Ustawienia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}