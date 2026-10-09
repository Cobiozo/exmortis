import React, { useState } from "react";
import { Loader2 } from "lucide-react";

// Usunięcie wymaga wpisania adresu — ochrona przed pomyłką.
export default function PersonDeleteBox({ email, busy, onDelete, onDone, icon: Icon }) {
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState(null);
  const ok = confirm.trim().toLowerCase() === email.toLowerCase();

  const run = async () => {
    const d = await onDelete(confirm.trim());
    if (!d.error) { setResult(d); setConfirm(""); onDone(); }
  };

  return (
    <div className="border border-[#BC1E22]/40 p-4 space-y-3">
      <p className="text-sm text-foreground/70">Usunięcie jest nieodwracalne. Zamówienia, odstąpienia, licencje i dowody zgód zostają (przepisy podatkowe i obrona roszczeń). Wpisz adres, aby potwierdzić.</p>
      <div className="flex flex-wrap gap-3">
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email}
          className="flex-1 min-w-[220px] bg-transparent border hairline px-4 py-3 focus:border-[#BC1E22] focus:outline-none" />
        <button onClick={run} disabled={!ok || busy} className="btn-blood !py-3 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} USUŃ DANE</button>
      </div>
      {result && (
        <div className="text-sm text-foreground/70">
          <p className="gold-text">Usunięto:</p>
          <ul className="list-disc ml-5">{Object.entries(result.removed).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
          <p>Konto: {result.konto}</p>
        </div>
      )}
    </div>
  );
}