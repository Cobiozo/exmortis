import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ecCall, EC_STATUS } from "./emailChangeApi";

// Dziennik zmian adresu + skrót do własnego konta administratora.
export default function EmailChangeLog({ onPick }) {
  const [rows, setRows] = useState(null);
  const [me, setMe] = useState(null);
  useEffect(() => { ecCall({ action: "log" }).then((r) => setRows(r.log || [])); base44.auth.me().then(setMe); }, []);
  return (
    <div className="space-y-4">
      <p className="text-foreground/40 text-sm">Wybierz klienta z listy.</p>
      {me && <button onClick={() => onPick(me.email)} className="btn-ghost !px-4 !py-2">MOJE KONTO</button>}
      <p className="technical text-[10px] gold-text pt-4">DZIENNIK ZMIAN ADRESU E-MAIL</p>
      {rows && rows.length === 0 && <p className="text-sm text-foreground/40">Brak wpisów.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y hairline text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2 flex flex-wrap gap-x-4">
              <span className="text-foreground/40">{new Date(r.created_date).toLocaleString("pl-PL")}</span>
              <span>{r.kto}</span><span>{r.old} → {r.new || "…"}</span>
              <span className="gold-text">{EC_STATUS[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}