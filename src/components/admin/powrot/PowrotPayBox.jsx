import React, { useState } from "react";
import { Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { POWROT } from "@/lib/powrotOffer";

const d = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");

export const payState = (a) => {
  if (a.paid_at) return { key: "paid", label: `opłacone ${d(a.paid_at)}` };
  if (a.pay_sent_at) {
    const live = a.pay_expires_at && new Date(a.pay_expires_at).getTime() > Date.now();
    return live
      ? { key: "sent", label: `link wysłany ${d(a.pay_sent_at)} · ważny do ${d(a.pay_expires_at)}` }
      : { key: "expired", label: `link wygasł ${d(a.pay_expires_at)}` };
  }
  return { key: "none", label: "link nie został wysłany" };
};

// Płatność za program: osobisty link (umowa + Regulamin w załączniku), wysyłany po rozmowie kwalifikacyjnej.
export default function PowrotPayBox({ a, onDone }) {
  const st = payState(a);
  const [amount, setAmount] = useState(String(a.pay_amount ? Number(a.pay_amount) : POWROT.price));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const send = async () => {
    const n = Number(String(amount).replace(",", ".").replace(/\s/g, ""));
    const label = `${n.toLocaleString("pl-PL")} zł`;
    if (!window.confirm(`Wysłać ${a.full_name} umowę i link do płatności na ${label}?`)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await base44.functions.invoke("adminPowrot", { action: "pay", id: a.id, amount: n });
      setMsg(r.data?.mail === "wyslany" ? "Wysłane: umowa, Regulamin i link do płatności." : "Mail czeka w kolejce wysyłki — wyjdzie z najbliższą partią.");
      onDone?.();
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się wysłać linku.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b hairline pb-4 space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="technical text-[10px] text-foreground/45 mb-1">PŁATNOŚĆ ZA PROGRAM</p>
          <p className={`text-sm ${st.key === "paid" ? "gold-text" : st.key === "expired" ? "blood-text" : "text-foreground/70"}`}>
            {st.label}{a.pay_amount && st.key !== "none" ? ` · ${Number(a.pay_amount).toLocaleString("pl-PL")} zł` : ""}
          </p>
        </div>
        {st.key !== "paid" && (
          <div className="flex items-end gap-2 ml-auto">
            <label className="text-xs text-foreground/55">
              <span className="technical text-[10px] block mb-1">KWOTA (ZŁ)</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 bg-transparent border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none"
              />
            </label>
            <button onClick={send} disabled={busy} className="btn-ghost !py-2 !px-4 text-[10px] disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              {st.key === "none" ? "WYŚLIJ LINK DO PŁATNOŚCI" : "WYŚLIJ NOWY LINK"}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground/45">
        Wysyłaj po rozmowie kwalifikacyjnej. Klient dostaje Umowę POWRÓT i Regulamin w załączniku oraz link ważny 7 dni (PayU, także raty PayPo). Nowy link unieważnia poprzedni.
      </p>
      {msg && <p className="text-xs gold-text">{msg}</p>}
      {err && <p className="text-xs blood-text flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />{err}</p>}
    </div>
  );
}
