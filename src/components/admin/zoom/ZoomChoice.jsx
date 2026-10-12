import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Chips } from "@/components/admin/events/form/ui";
import { useFixedZoom } from "./fixedZoom";

// Wybór linku do pokoju: „Mój stały link” (z Ustawień strony) albo „Inny link” (pola przekazane jako children).
// Wybranie stałego linku wpisuje go do spotkania/rodzaju konsultacji — tak jak wpisany ręcznie.
export default function ZoomChoice({ link, withPassword = false, onSet, error, children }) {
  const z = useFixedZoom();
  const [other, setOther] = useState(false);
  if (!z) return children;
  if (!z.link) return (
    <div className="space-y-2">
      {children}
      <p className="text-xs text-foreground/45">Masz stały pokój Zoom? Dodaj go w <Link to="/admin/ustawienia" className="underline hover:text-foreground">Ustawieniach strony</Link> („Mój stały link Zoom”), a tutaj wybierzesz go jednym kliknięciem.</p>
    </div>
  );
  const fixed = !other && String(link || "").trim() === z.link;
  const pick = (v) => {
    if (v === "staly") { setOther(false); onSet(withPassword ? { link: z.link, haslo: z.haslo } : { link: z.link }); }
    else { setOther(true); if (String(link || "").trim() === z.link) onSet(withPassword ? { link: "", haslo: "" } : { link: "" }); }
  };
  return (
    <div className="space-y-3 min-w-0">
      <Chips label="Link do pokoju" value={fixed ? "staly" : "inny"} options={[["staly", "Mój stały link"], ["inny", "Inny link"]]} onChange={pick} />
      {fixed ? (
        <div className="border hairline px-4 py-3 text-sm min-w-0">
          <p className="truncate text-foreground/80">{z.link}</p>
          {withPassword && z.haslo && <p className="text-foreground/50 mt-1">Hasło: {z.haslo}</p>}
          {!withPassword && z.haslo && !/[?&]pwd=/.test(z.link) && <p className="text-[#E8676A] text-xs mt-1">Tutaj klient dostaje sam link, bez osobnego hasła — w Ustawieniach wklej link z wbudowanym hasłem (…?pwd=…).</p>}
          <p className="text-xs text-foreground/45 mt-1">Stały link z Ustawień strony.</p>
          {error && <p role="alert" className="text-sm text-[#E5484D] mt-1.5">{error}</p>}
        </div>
      ) : children}
    </div>
  );
}
