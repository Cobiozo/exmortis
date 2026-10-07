import React, { useEffect, useState } from "react";
import { APP, STATUSES, SMIERC, FORMA, label, exportCsv } from "./appUtils";
import ApplicationCard from "./ApplicationCard";

const SIX_M = 182 * 86400000;

export default function ApplicationsTab() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null);
  const load = () => APP.filter(status ? { status } : {}, { sort: "-created_date", limit: 200 }).then((p) => setRows(p.items));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = (r) => { setOpen(r); load(); };
  const soon = (r) => ["nowe", "przeczytane", "odrzucone"].includes(r.status) && Date.now() - new Date(r.created_date) > SIX_M - 7 * 86400000;
  if (!rows) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {[["", "Wszystkie"], ...STATUSES].map(([v, l]) => <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 technical text-[10px] border ${status === v ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>{l}</button>)}
        <button onClick={() => exportCsv(rows)} className="ml-auto btn-ghost !py-2 !px-4 text-[10px]">Eksport CSV</button>
      </div>
      {open && <ApplicationCard key={open.id} a={open} onChange={changed} onClose={() => setOpen(null)} />}
      <div className="overflow-x-auto border hairline">
        <table className="w-full text-sm">
          <thead className="technical text-[9px] text-foreground/40 text-left"><tr><th className="p-3">DATA</th><th className="p-3">IMIĘ</th><th className="p-3">ŚMIERĆ</th><th className="p-3">FORMA</th><th className="p-3">STATUS</th><th className="p-3">OZNACZENIA</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} className="border-t hairline cursor-pointer hover:bg-[#121212]">
                <td className="p-3 text-foreground/50">{new Date(r.created_date).toLocaleDateString("pl-PL")}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3">{SMIERC[r.smierc] || "—"}</td>
                <td className="p-3">{FORMA[r.forma] || "—"}</td>
                <td className="p-3 gold-text">{label(r.status)}</td>
                <td className="p-3 space-x-2">
                  {r.pilne && <span className="bg-[#BC1E22] text-[#F5EFE1] technical text-[9px] px-2 py-0.5">SPRAWDŹ PILNIE</span>}
                  {soon(r) && <span className="text-[#E8C547] text-xs">usunięcie za &lt;7 dni</span>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-foreground/45">Brak zgłoszeń.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}