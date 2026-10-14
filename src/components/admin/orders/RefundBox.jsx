import React from "react";
import { RotateCcw } from "lucide-react";

const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;
const when = (iso) => (iso ? new Date(iso).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric" }) : "");

const STATUS = { przyjety: "PRZYJĘTY", w_toku: "W TOKU", blad: "ODRZUCONY", nowy: "ZGŁOSZONY" };

export const canRefund = (o) =>
  o?.status === "COMPLETED" && !!o.payu_order_id && !String(o.payu_order_id).startsWith("FREE-");

export const refundLabel = (o) => {
  const r = Number(o?.refunded_total || 0);
  if (!r) return "";
  return r >= Number(o?.total || 0) - 0.001 ? " · ZWRÓCONE" : " · CZĘŚCIOWY ZWROT";
};

// Zwroty zamówienia: historia i przycisk zlecenia kolejnego (tylko dla zamówień opłaconych przez PayU).
export default function RefundBox({ order, refunds, onOpen }) {
  if (!canRefund(order) && !(refunds || []).length) return null;
  const refunded = Number(order?.refunded_total || 0);
  return (
    <div className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] gold-text flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" /> ZWROTY</p>
      {refunded > 0 && (
        <p className="text-sm text-foreground/80">
          Zwrócono {zl(refunded)} z {zl(order.total)}{Number(order.total) - refunded > 0.001 ? ` · zostało ${zl(Number(order.total) - refunded)}` : " · całość"}
        </p>
      )}
      {(refunds || []).map((r) => (
        <p key={r.id} className="text-xs text-foreground/60 border-t hairline pt-2">
          <span className="font-mono gold-text">{zl(r.amount)}</span> · {when(r.created_at)} · {STATUS[r.status] || String(r.status || "").toUpperCase()}
          {r.reason ? <span className="block text-foreground/45 mt-1">{r.reason}</span> : null}
        </p>
      ))}
      {canRefund(order) && (
        <button onClick={() => onOpen(order)} className="btn-ghost !px-4 !py-2 text-[10px]">
          <RotateCcw className="h-4 w-4" /> ZWROT
        </button>
      )}
    </div>
  );
}