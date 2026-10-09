import React, { useEffect, useState } from "react";
import { ecCall } from "@/components/admin/clients/emailChangeApi";

// RODO: powiązane adresy po zmianie adresu e-mail — kliknij, aby wyszukać drugi.
export default function EmailAliases({ email, onPick }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { ecCall({ action: "aliases", email }).then((r) => setRows(r.aliases || [])); }, [email]);
  if (!rows.length) return null;
  return (
    <div className="border hairline p-4 text-sm space-y-1">
      <p className="technical text-[10px] gold-text">POWIĄZANE ADRESY (ZMIANA ADRESU)</p>
      {rows.map((r) => {
        const other = r.old === email.toLowerCase() ? r.new : r.old;
        return <p key={r.old + r.new}>{r.old} → {r.new} · {new Date(r.at).toLocaleDateString("pl-PL")} · <button onClick={() => onPick(other)} className="gold-text underline">szukaj {other}</button></p>;
      })}
    </div>
  );
}