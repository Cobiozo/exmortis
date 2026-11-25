import React, { useState } from "react";
import { Loader2, MailWarning } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Zwroty poczty (25.11.2026): adresy, na które mail nie doszedł (skrzynka nie istnieje, literówka).
// Czytane ze skrzynki kontakt@ tylko do odczytu. Kliknięcie adresu wpisuje go w wyszukiwarkę zamówień.
export default function BouncesBox({ onPick }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async () => {
    setBusy(true); setErr("");
    try { setList((await base44.functions.invoke("adminOrders", { action: "bounces", days: 7 })).data.bounces || []); }
    catch (e) { setErr(e?.response?.data?.error || "Nie udało się sprawdzić skrzynki."); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="technical text-[10px] gold-text flex items-center gap-2"><MailWarning className="h-3.5 w-3.5" /> MAILE, KTÓRE NIE DOSZŁY (7 DNI)</p>
        <button onClick={load} disabled={busy} className="btn-ghost !px-4 !py-2 text-[10px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : list ? "Sprawdź ponownie" : "Sprawdź zwroty poczty"}</button>
      </div>
      {err && <p className="text-xs text-[#E8C547]">{err}</p>}
      {list && (list.length === 0 ? <p className="text-sm text-foreground/60">Brak zwrotów — wszystkie maile doszły.</p> : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li key={b.email} className="text-sm">
              <button onClick={() => onPick?.(b.email)} className="text-[#F5EFE1] underline underline-offset-4 break-all hover:text-[#C9A24A]">{b.email}</button>
              <span className="block text-xs text-foreground/50">{b.reason}</span>
            </li>
          ))}
          <li className="text-xs text-foreground/50 pt-1">Kliknij adres, żeby znaleźć zamówienie, i użyj „Popraw e-mail i wyślij dostęp ponownie”.</li>
        </ul>
      ))}
    </div>
  );
}
