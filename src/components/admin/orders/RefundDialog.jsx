import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;
const shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();

// Zwrot PayU z panelu. Kwota domyślnie całość, można zmniejszyć. Skutki zaznaczone domyślnie.
// Potwierdzenie podwójne: kwotę trzeba wpisać drugi raz.
export default function RefundDialog({ order, onClose, onDone }) {
  const paid = Number(order?.total || 0);
  const refunded = Number(order?.refunded_total || 0);
  const left = Math.round((paid - refunded) * 100) / 100;

  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [opts, setOpts] = useState({ revoke_access: true, cancel_tickets: true, void_cards: true });
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  if (!order) return null;

  const amt = Number(String(amount).replace(",", "."));
  const confirmOk = confirm.trim() === amount.trim() && amount.trim() !== "";

  const submit = async () => {
    setErr("");
    if (!Number.isFinite(amt) || amt <= 0) return setErr("Kwota zwrotu musi być większa od zera.");
    if (Math.round(amt * 100) / 100 > left) return setErr(`Za dużo — do zwrotu zostało ${zl(left)}.`);
    if (!confirmOk) return setErr("Wpisz kwotę ponownie, tak samo.");
    setBusy(true);
    try {
      const r = await base44.functions.invoke("adminOrders", {
        action: "refund", id: order.id, amount: amt, reason, opts,
      });
      setDone(r.data);
    } catch (e) {
      const code = e?.response?.data?.error;
      setErr(code === "PAYU_NOT_CONFIGURED" ? "PayU nie jest skonfigurowane (Ustawienia → Płatności)." : code || "Nie udało się zlecić zwrotu.");
    }
    setBusy(false);
  };

  const inputCls = "w-full bg-transparent border hairline px-3 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Zwrot">
      <div className="absolute inset-0 bg-[#0A0A0B]/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg border border-[#C9A24A]/30 bg-[#0D0D0E] p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-foreground/40 hover:text-foreground" aria-label="Zamknij">
          <X className="h-4 w-4" />
        </button>

        {done ? (
          <div className="space-y-3 py-4">
            <p className="technical text-[10px] gold-text">ZWROT ZLECONY</p>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {done.status === "przyjety"
                ? `PayU przyjęło zwrot ${zl(done.amount)}. Dostęp, bilety i karty z tego zamówienia zostały rozliczone, a klient dostał wiadomość.`
                : `PayU przyjęło zgłoszenie zwrotu ${zl(done.amount)} — potwierdzenie przyjdzie powiadomieniem i wtedy wykonają się skutki.`}
            </p>
            <button onClick={onDone} className="btn-relic !px-5 !py-2.5 text-[10px]">ZAMKNIJ</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="technical text-[10px] gold-text">ZWROT — ZAMÓWIENIE {shortNo(order.id)}</p>
              <p className="text-sm text-foreground/70 mt-2">
                Zapłacono {zl(paid)}{refunded > 0 ? `, zwrócono ${zl(refunded)}` : ""}. Do zwrotu zostało <span className="gold-text">{zl(left)}</span>.
              </p>
            </div>

            <div>
              <label className="technical text-[9px] text-foreground/50 block mb-2">KWOTA ZWROTU (ZŁ)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputCls} />
              <button type="button" onClick={() => setAmount(String(left))} className="text-[11px] gold-text mt-1.5">cała pozostała kwota</button>
            </div>

            <div>
              <label className="technical text-[9px] text-foreground/50 block mb-2">POWÓD</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
                placeholder="np. odstąpienie od umowy w terminie 14 dni" className={inputCls} />
            </div>

            <div className="space-y-2">
              <p className="technical text-[9px] text-foreground/50">SKUTKI ZWROTU</p>
              {[["revoke_access", "Odbierz dostęp do produktów z zamówienia"], ["cancel_tickets", "Anuluj bilety z zamówienia"], ["void_cards", "Unieważnij niewykorzystane karty podarunkowe"]].map(([k, l]) => (
                <label key={k} className="flex items-start gap-3 text-sm text-foreground/80 cursor-pointer">
                  <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} className="h-4 w-4 mt-0.5 accent-[#C9A24A]" />
                  {l}
                </label>
              ))}
              <p className="text-[11px] text-foreground/45">Wykonają się dopiero, gdy PayU przyjmie zwrot.</p>
            </div>

            <div>
              <label className="technical text-[9px] text-foreground/50 block mb-2">POTWIERDZENIE — WPISZ KWOTĘ PONOWNIE</label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} inputMode="decimal" className={inputCls} />
            </div>

            {err && <p className="text-xs text-[#E8C547]">{err}</p>}

            <div className="flex flex-wrap gap-3">
              <button onClick={submit} disabled={busy || !confirmOk} className="btn-relic !px-5 !py-2.5 text-[10px] disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZLEĆ ZWROT"}
              </button>
              <button onClick={onClose} className="btn-ghost !px-5 !py-2.5 text-[10px]">ANULUJ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}