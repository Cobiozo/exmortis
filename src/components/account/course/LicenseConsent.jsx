import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

// Jednorazowa zgoda licencyjna w stronie (zapisywana na koncie z datą).
export default function LicenseConsent({ onAccept }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const accept = async () => {
    setBusy(true);
    setErr("");
    try {
      await base44.auth.updateMe({ license_consent_at: new Date().toISOString() });
      onAccept();
    } catch {
      setBusy(false);
      setErr("Nie udało się zapisać zgody. Spróbuj ponownie.");
    }
  };
  return (
    <div role="dialog" aria-labelledby="lic-h" className="border border-[#C9A24A]/50 p-8 md:p-10 max-w-xl mx-auto text-center space-y-6 bg-[#0F0F10]">
      <p id="lic-h" className="technical text-[10px] gold-text">LICENCJA OSOBISTA</p>
      <p className="text-foreground/80 leading-relaxed">Te materiały są przeznaczone tylko dla Ciebie. Nie udostępniaj konta ani nagrań — każdy film jest oznaczony Twoim adresem.</p>
      {err && <p role="alert" className="text-sm text-[#E8C547]">{err}</p>}
      <button onClick={accept} disabled={busy} className="btn-relic disabled:opacity-50">ROZUMIEM</button>
    </div>
  );
}