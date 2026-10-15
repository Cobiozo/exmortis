import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SettingsCard, { BTN_SECONDARY, maskEmail } from "./SettingsCard";

export default function SecurityCard({ me }) {
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (left > 0) { const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); } }, [left]);

  const send = async () => {
    setBusy(true);
    await base44.auth.resetPasswordRequest(me.email).catch(() => {});
    setBusy(false); setSent(true); setLeft(60);
  };

  return (
    <SettingsCard title="Bezpieczeństwo">
      <p className="text-[#E2E2E2]/80 mb-4">Wyślę link do zmiany hasła na Twój adres e-mail.</p>
      <button type="button" onClick={send} disabled={busy || left > 0} className={BTN_SECONDARY}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {left > 0 ? `Zmień hasło (${left} s)` : "Zmień hasło"}
      </button>
      {sent && <p role="status" className="text-sm text-[#C9A24A] mt-3">Link wysłany na {maskEmail(me.email)}. Sprawdź skrzynkę.</p>}
    </SettingsCard>
  );
}