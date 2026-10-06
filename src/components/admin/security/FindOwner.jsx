import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Znajdź właściciela kopii: identyfikator licencji, numer zamówienia albo e-mail.
export default function FindOwner() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const find = async (e) => {
    e.preventDefault(); setBusy(true);
    const r = await base44.functions.invoke("adminClients", { action: "find", q });
    setRes(r.data.people); setBusy(false);
  };
  return (
    <section>
      <p className="technical text-[10px] gold-text mb-3">ZNAJDŹ WŁAŚCICIELA KOPII</p>
      <form onSubmit={find} className="flex gap-3 max-w-xl">
        <input required value={q} onChange={(e) => setQ(e.target.value)} placeholder="EXM-…, numer zamówienia, ID z filmu albo e-mail" className="flex-1 bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none" />
        <button className="btn-relic !px-5 !py-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "SZUKAJ"}</button>
      </form>
      {res && res.length === 0 && <p className="text-sm text-foreground/50 mt-4">Nic nie znaleziono.</p>}
      {res?.map((p) => (
        <div key={p.email} className="border hairline p-5 mt-5 space-y-3 text-sm">
          <p className="gold-text">{p.email}</p>
          {p.licenses.map((l) => <p key={l.id} className="text-xs">Licencja {l.license_id} · {l.product_name} · zam. {l.order_id || "ręczne"} · pobrań: {l.downloads || 0}</p>)}
          <p className="text-xs text-foreground/60">Dostępy: {p.access.map((a) => `${a.product_name} (ID filmu ${a.id.slice(-8).toUpperCase()})`).join(", ") || "brak"}</p>
          <p className="text-xs text-foreground/50">Pobrania PDF: {p.pdfs.map((x) => new Date(x.created_date).toLocaleString("pl-PL") + " " + x.ip).join(" · ") || "brak"}</p>
          <p className="text-xs text-foreground/50">Odtworzenia: {p.plays.map((x) => new Date(x.created_date).toLocaleString("pl-PL") + " " + x.ip).join(" · ") || "brak"}</p>
        </div>
      ))}
    </section>
  );
}