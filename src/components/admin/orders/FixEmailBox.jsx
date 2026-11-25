import React, { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Poprawka adresu kupującego (25.11.2026): literówka → materiały nie docierają. Zmienia adres w zamówieniu,
// przenosi dostępy z tego zamówienia na nowy adres i wysyła nowy link do materiałów (dla opłaconych).
export default function FixEmailBox({ o, onDone }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    const v = email.trim();
    if (!v) return;
    if (!window.confirm(`Zmienić adres w zamówieniu ${String(o.id).slice(0, 8).toUpperCase()} na ${v} i wysłać tam dostęp do materiałów?`)) return;
    setBusy(true); setMsg("");
    try {
      const r = await base44.functions.invoke("adminOrders", { action: "fix_email", id: o.id, email: v });
      setMsg(`Gotowe: adres zmieniony${r.data.moved ? `, przeniesione dostępy: ${r.data.moved}` : ""}${r.data.sent ? ", nowy link wysłany" : o.status === "COMPLETED" ? ", ale to zamówienie nie ma materiałów do wysłania" : " (zamówienie nieopłacone — bez wysyłki)"}.`);
      setOpen(false); setEmail("");
      onDone?.();
    } catch (e) { setMsg(e?.response?.data?.error || "Nie udało się zmienić adresu."); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] gold-text flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> ADRES KUPUJĄCEGO</p>
      <p className="text-sm text-foreground/80 break-all">{o.buyer_email || "—"}</p>
      {!open ? (
        <button onClick={() => { setOpen(true); setMsg(""); }} className="btn-ghost !px-4 !py-2 text-[10px]">Popraw e-mail i wyślij dostęp ponownie</button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Poprawny adres e-mail" aria-label="Poprawny adres e-mail"
            className="bg-transparent border hairline px-3 py-2 text-sm min-w-0 basis-full sm:basis-auto flex-1 focus:border-[#C9A24A] focus:outline-none" />
          <button onClick={save} disabled={busy || !email.trim()} className="btn-relic !px-4 !py-2 text-[10px] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zapisz i wyślij"}</button>
          <button onClick={() => setOpen(false)} className="text-xs text-foreground/50 underline">Anuluj</button>
        </div>
      )}
      {msg && <p className="text-xs text-foreground/70" role="status">{msg}</p>}
    </div>
  );
}
