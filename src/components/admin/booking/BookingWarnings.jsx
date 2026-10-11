import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle } from "lucide-react";

// Pulpit: brak kluczy rezerwacji (czerwone) i logowanie hasłem zamiast Google.
export default function BookingWarnings() {
  const [keysOk, setKeysOk] = useState(true);
  const via = localStorage.getItem("exm_login_via");
  useEffect(() => {
    base44.functions.invoke("bookingAdmin", { action: "status" }).then((r) => setKeysOk(r.data.keys_ok)).catch(() => {});
  }, []);
  return (
    <>
      {!keysOk && (
        <div className="mb-6 border border-[#BC1E22] bg-[#BC1E22]/15 p-5 flex gap-3 items-start" role="alert">
          <AlertTriangle className="h-5 w-5 blood-text shrink-0 mt-0.5" />
          <div><p className="technical text-xs blood-text">Brak kluczy bezpieczeństwa rezerwacji</p>
            <p className="text-sm text-foreground/70 mt-1">Rezerwacje 1:1 są niedostępne, dopóki w sekretach aplikacji nie będzie obu kluczy (min. 32 bajty).</p></div>
        </div>
      )}
      {via === "haslo" && (
        <div className="mb-6 border border-[#C9A24A]/60 bg-[#C9A24A]/10 p-5 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 gold-text shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80">Zalogowałeś się hasłem. Do panelu administratora loguj się przez Google — to konto chroni logowanie dwuskładnikowe.</p>
        </div>
      )}
    </>
  );
}