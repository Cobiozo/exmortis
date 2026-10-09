import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

// SPF / DKIM / DMARC domeny nadawcy (odczyt publicznego DNS).
export default function MailDns() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    const r = await base44.functions.invoke("mailAdmin", { action: "dns" }).catch(() => null);
    setD(r?.data?.dns || false); setBusy(false);
  };
  const Row = ({ name, ok, info }) => (
    <li className={ok ? "gold-text" : "blood-text"}>{name}: {ok ? info : "BRAK — maile mogą trafiać do spamu"}</li>
  );
  return (
    <div className="border hairline p-5 space-y-3">
      <div className="flex items-center gap-4">
        <p className="technical text-[10px] text-foreground/50">DNS DOMENY NADAWCY</p>
        <button onClick={check} disabled={busy} className="btn-ghost !px-3 !py-1.5 disabled:opacity-50">{busy ? "SPRAWDZAM…" : "SPRAWDŹ"}</button>
      </div>
      {d === false && <p className="text-sm text-foreground/50">Wpisz i zapisz adres nadawcy, aby sprawdzić domenę.</p>}
      {d && (
        <ul className="text-sm space-y-1 break-all">
          <li className="text-foreground/50">Domena: {d.domain}</li>
          <Row name="SPF" ok={!!d.spf} info={d.spf} />
          <Row name="DKIM" ok={d.dkim.length > 0} info={`selektor: ${d.dkim.join(", ")}`} />
          <Row name="DMARC" ok={!!d.dmarc} info={d.dmarc} />
          {d.dkim.length === 0 && <li className="text-xs text-foreground/40">DKIM sprawdzam po typowych selektorach. Jeśli dostawca podał inny, zweryfikuj u niego.</li>}
        </ul>
      )}
    </div>
  );
}