import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Pole kodu rabatowego w podsumowaniu kasy. applied: { code, discount } | null
export default function DiscountField({ items, applied, onApply }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const check = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("checkDiscount", { code, items: items.map((i) => ({ id: i.id, qty: i.qty })) });
      onApply(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się sprawdzić kodu");
    }
    setBusy(false);
  };

  if (applied) {
    return (
      <div className="flex justify-between items-center text-sm">
        <span className="gold-text">Kod {applied.code}: −{applied.discount.toFixed(2)} zł</span>
        <button type="button" onClick={() => { onApply(null); setCode(""); }} className="technical text-[10px] text-foreground/55 hover:gold-text">USUŃ</button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Kod rabatowy" className="flex-1 min-w-0 bg-transparent border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none" />
        <button type="button" onClick={check} disabled={busy} className="btn-ghost !px-4 !py-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "UŻYJ"}</button>
      </div>
      {err && <p className="text-xs text-[#E8C547] mt-2">{err}</p>}
    </div>
  );
}