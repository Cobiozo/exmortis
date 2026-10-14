import React, { useState } from "react";
import { Loader2, FileText, RefreshCw, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();

// Faktura z Fakturowni: numer, link do PDF i ponowienie po błędzie wystawienia.
export default function FakturaBlock({ o }) {
  const [busy, setBusy] = useState(false);
  const [num, setNum] = useState(o.invoice_number || "");
  const [url, setUrl] = useState(o.invoice_url || "");
  const [err, setErr] = useState(o.invoice_error || "");
  const [done, setDone] = useState("");

  if (!(num || url || err)) return null;

  const retry = async () => {
    setBusy(true); setDone("");
    try {
      const r = await base44.functions.invoke("adminOrders", { action: "invoice_retry", id: o.id });
      const d = r.data || {};
      if (d.ok) {
        setNum(d.number || num); setUrl(d.url || url); setErr("");
        setDone(`Wystawiona${d.number ? `: ${d.number}` : ""}`);
      } else {
        setErr(d.error || "Nie udało się wystawić faktury.");
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się wystawić faktury.");
    }
    setBusy(false);
  };

  return (
    <div className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] gold-text flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> FAKTURA (FAKTUROWNIA)</p>
      {(num || url) && (
        <p className="text-sm text-[#9FD3A0]">
          Wystawiona{num ? `: ${num}` : ""}
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="gold-text underline ml-2">PDF</a>}
        </p>
      )}
      {err && (
        <p className="text-xs text-[#E8C547] flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{err}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={retry} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-[10px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> {err ? "WYSTAW PONOWNIE" : "WYSTAW FAKTURĘ"}</>}
        </button>
        {done && <span className="text-xs gold-text">{done}</span>}
      </div>
      <p className="text-xs text-foreground/45">Zamówienie {shortNo(o.id)} · dokument wystawia Fakturownia.</p>
    </div>
  );
}