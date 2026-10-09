import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { MAIL_KINDS } from "@/lib/useMailStatus";

const LABEL = { wyslany: "WYSŁANY", kolejka: "W KOLEJCE", blad: "BŁĄD", pominiety: "POMINIĘTY" };
const COLOR = { wyslany: "gold-text", kolejka: "text-foreground/50", blad: "blood-text", pominiety: "text-foreground/30" };

// Dziennik wysyłek (ostatnie 100), adresy zamaskowane.
export default function MailLog() {
  const [rows, setRows] = useState(null);
  const load = () => base44.functions.invoke("mailAdmin", { action: "log" }).then((r) => setRows(r.data.log));
  return (
    <div className="border hairline p-5">
      <div className="flex items-center gap-4 mb-3">
        <p className="technical text-[10px] text-foreground/50">DZIENNIK WYSYŁEK</p>
        <button onClick={load} className="btn-ghost !px-3 !py-1.5">{rows ? "ODŚWIEŻ" : "POKAŻ"}</button>
      </div>
      {rows && rows.length === 0 && <p className="text-sm text-foreground/40">Brak wpisów.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y hairline text-sm">
          {rows.map((m) => (
            <li key={m.id} className="py-2 flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-foreground/40 w-36">{new Date(m.at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>
              <span className="w-48">{m.to}</span>
              <span className="text-foreground/60 w-48">{MAIL_KINDS[m.kind] || m.kind}</span>
              <span className={`technical text-[10px] ${COLOR[m.status]}`}>{LABEL[m.status]}</span>
              {m.blad && <span className="blood-text text-xs w-full">{m.blad}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}