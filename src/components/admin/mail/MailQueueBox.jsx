import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { MAIL_KINDS } from "@/lib/useMailStatus";

// Kolejka „Oczekuje na konfigurację” + ręczna wysyłka zaległych.
export default function MailQueueBox({ status, ready, onDone }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const q = status.queue || { total: 0, byKind: {} };

  const flush = async () => {
    setBusy(true); setRes(null);
    const sum = { sent: 0, skipped: 0, failed: 0 };
    try {
      for (let i = 0; i < 100; i++) {
        const r = (await base44.functions.invoke("mailAdmin", { action: "flush" })).data;
        sum.sent += r.sent; sum.skipped += r.skipped; sum.failed += r.failed;
        if (!r.more) break;
      }
      setRes(`Wysłane: ${sum.sent} · pominięte (termin minął): ${sum.skipped} · błędy: ${sum.failed}`);
    } catch (e) {
      setRes(e?.response?.data?.error || "Nie udało się.");
    }
    setBusy(false); onDone();
  };

  return (
    <div className="border hairline p-5 space-y-3">
      <p className="technical text-[10px] gold-text">W KOLEJCE: {q.total} MAILI</p>
      {q.total > 0 && (
        <ul className="text-sm text-foreground/60 space-y-1">
          {Object.entries(q.byKind).map(([k, n]) => <li key={k}>{MAIL_KINDS[k] || k}: {n}</li>)}
        </ul>
      )}
      {ready && q.total > 0 && (
        <button onClick={flush} disabled={busy} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">{busy ? "WYSYŁAM…" : "WYŚLIJ ZALEGŁE"}</button>
      )}
      {!ready && q.total > 0 && <p className="text-xs text-foreground/40">Wysyłka zaległych będzie możliwa po udanym teście.</p>}
      {res && <p className="text-sm gold-text">{res}</p>}
    </div>
  );
}