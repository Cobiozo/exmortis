import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function ContactsPanel() {
  const [rows, setRows] = useState(null);
  const [src, setSrc] = useState("");

  useEffect(() => {
    base44.functions.invoke("adminDashboard", { action: "contacts" }).then((r) => setRows(r.data.contacts || []));
  }, []);

  if (!rows) return <p className="text-foreground/50">Ładowanie…</p>;
  const sources = [...new Set(rows.map((r) => r.source))];
  const shown = src ? rows.filter((r) => r.source === src) : rows;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {["", ...sources].map((s) => (
          <button key={s} onClick={() => setSrc(s)} className={`px-4 py-2 technical text-[10px] border ${src === s ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>
            {s || "WSZYSTKIE"}
          </button>
        ))}
        <span className="technical text-[10px] text-foreground/40 self-center ml-2">{shown.length} POZYCJI</span>
      </div>
      <div className="overflow-x-auto border hairline">
        <table className="w-full text-sm">
          <thead className="technical text-[9px] text-foreground/40 text-left">
            <tr><th className="p-3">ŹRÓDŁO</th><th className="p-3">IMIĘ</th><th className="p-3">E-MAIL</th><th className="p-3">TELEFON</th><th className="p-3">DATA</th><th className="p-3">OZNACZENIA</th></tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t hairline">
                <td className="p-3 gold-text">{r.source}</td>
                <td className="p-3">{r.name || "—"}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.phone || "—"}</td>
                <td className="p-3 text-foreground/50">{r.at ? new Date(r.at).toLocaleDateString("pl-PL") : "—"}</td>
                <td className="p-3">
                  {r.pilne && <span className="bg-[#BC1E22] text-[#F5EFE1] technical text-[9px] px-2 py-0.5">PILNE</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}