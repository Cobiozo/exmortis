import React, { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClientDetail from "./ClientDetail";
import GrantForm from "./GrantForm";

const call = (p) => base44.functions.invoke("adminClients", p).then((r) => r.data);

export default function ClientsPanel() {
  const [clients, setClients] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const load = () => call({ action: "list" }).then((d) => setClients(d.clients));
  useEffect(() => { load(); }, []);

  const shown = (clients || []).filter((c) => c.email.includes(q.toLowerCase()));
  const exportCsv = () => {
    const csv = "email,liczba_dostepow\n" + clients.map((c) => `${c.email},${c.count}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "klienci-exmortis.csv";
    a.click();
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-10">
      <div className="space-y-4">
        <GrantForm onDone={(e) => { load(); setSel(e); }} />
        <div className="flex gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj e-maila" className="flex-1 bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none" />
          <button onClick={exportCsv} disabled={!clients} className="btn-ghost !px-3 !py-2" title="Eksport CSV"><Download className="h-4 w-4" /></button>
        </div>
        {!clients ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : shown.length === 0 ? (
          <p className="text-sm text-foreground/50">Brak klientów z dostępami.</p>
        ) : (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            {shown.map((c) => (
              <button key={c.email} onClick={() => setSel(c.email)} className={`w-full text-left px-4 py-3 flex justify-between text-sm hover:bg-[#0F0F10] ${sel === c.email ? "bg-[#0F0F10] gold-text" : ""}`}>
                <span className="truncate">{c.email}</span><span className="text-foreground/40">{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {sel ? <ClientDetail key={sel} email={sel} onChange={load} /> : <p className="text-foreground/40 text-sm">Wybierz klienta z listy.</p>}
    </div>
  );
}