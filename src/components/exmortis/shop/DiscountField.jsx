import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Pole kodu rabatowego w podsumowaniu kasy (na jasnej karcie). applied: { code, discount } | null
// Walidacja i wywołanie checkDiscount bez zmian — tylko wygląd.
const inp =
  "min-h-[44px] min-w-0 flex-1 rounded-[var(--exm-r-field)] border border-exm-bg/25 bg-white/70 px-3 py-2.5 text-[14px] text-exm-bg placeholder:text-exm-bg/50 focus:border-exm-bg focus:outline-none";
const btn =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--exm-r-field)] border border-exm-bg/30 px-4 text-[14px] font-medium text-exm-bg transition-colors hover:bg-exm-bg/5 disabled:opacity-60";

export default function DiscountField({ items, applied, onApply, email = "" }) {
  // Kod z popupu (kampania „Rabat”) czeka w tej karcie przeglądarki — wpisuje się sam, użycie zatwierdza klient.
  const [code, setCode] = useState(() => { try { return sessionStorage.getItem("exm_kod") || ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const check = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("checkDiscount", { code, email, items: items.map((i) => ({ id: i.id, qty: i.qty })) });
      onApply(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się sprawdzić kodu");
    }
    setBusy(false);
  };

  if (applied) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-medium text-exm-bg">Kod {applied.code}: −{applied.discount.toFixed(2)} zł</span>
          <button
            type="button"
            onClick={() => { onApply(null); setCode(""); }}
            className="text-[12px] text-exm-bg/70 underline underline-offset-4 hover:text-exm-bg"
          >
            Usuń
          </button>
        </div>
        {(applied.lowest || []).map((l) => (
          <p key={l.name} className="text-[11px] leading-relaxed text-exm-bg/60">Najniższa cena z 30 dni przed obniżką ({l.name}): {Number(l.price).toFixed(2).replace(".", ",")} zł</p>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          aria-label="Kod rabatowy"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Kod rabatowy"
          className={inp}
        />
        <button type="button" onClick={check} disabled={busy} className={btn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Użyj"}
        </button>
      </div>
      {err && <p className="mt-2 text-[12px] font-medium text-[#8A3B12]">{err}</p>}
    </div>
  );
}