import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import useMailStatus from "@/lib/useMailStatus";
import MailQueueBox from "./MailQueueBox";
import MailDns from "./MailDns";
import MailLog from "./MailLog";

const inp = "w-full bg-transparent border hairline px-4 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none";
const FIELDS = [
  ["host", "HOST SMTP", "smtp.twojadostawca.pl"], ["port", "PORT", "587"], ["user", "LOGIN", ""],
  ["password", "HASŁO / KLUCZ", ""], ["from", "ADRES NADAWCY", "kontakt@exmortis.pl"],
  ["from_name", "NAZWA NADAWCY", "exmortis"], ["reply_to", "REPLY-TO", "kontakt@exmortis.pl"],
];

// Ustawienia → Wysyłka e-mail.
export default function MailSettings() {
  const { status, ready, reload } = useMailStatus();
  const [f, setF] = useState(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (status && !f) setF({ port: "587", from_name: "exmortis", ...Object.fromEntries(Object.entries(status.config || {}).filter(([, v]) => v)) }); }, [status, f]);

  const run = async (action, data) => {
    setBusy(true); setMsg(null);
    const r = await base44.functions.invoke("mailAdmin", { action, ...data }).catch((e) => ({ data: { ok: false, error: e?.response?.data?.error || e.message } }));
    setBusy(false);
    if (action === "save") setMsg(r.data?.ok ? { ok: true, t: "Zapisano. Wyślij test, aby włączyć wysyłkę." } : { ok: false, t: r.data?.error });
    if (action === "test") setMsg(r.data?.ok ? { ok: true, t: "Test wysłany. Wysyłka DZIAŁA." } : { ok: false, t: `Błąd: ${r.data?.error}` });
    reload();
  };

  if (!status || !f) return <section className="border hairline p-8"><p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p></section>;
  return (
    <section className="border hairline p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="relic-heading text-xl">Wysyłka e-mail</h2>
        <span className={`technical text-[10px] px-3 py-1 border ${ready ? "border-[#C9A24A] gold-text" : "border-foreground/30 text-foreground/50"}`}>{ready ? "DZIAŁA" : "NIESKONFIGUROWANA"}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map(([k, label, ph]) => (
          <label key={k} className="block">
            <span className="block technical text-[10px] text-foreground/50 mb-2">{label}</span>
            <input type={k === "password" ? "password" : "text"} autoComplete="off" value={f[k] || ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inp} />
          </label>
        ))}
      </div>
      <p className="text-xs text-foreground/40">Hasło zapisuje się tylko na serwerze i po zapisie nie jest wyświetlane. Zostaw maskę, aby zachować zapisane.</p>
      <button onClick={() => run("save", { data: f })} disabled={busy} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">ZAPISZ</button>
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t hairline">
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="adres do testu" className={inp} />
        <button onClick={() => run("test", { to })} disabled={busy || !to} className="btn-ghost !px-5 !py-2.5 whitespace-nowrap disabled:opacity-50">{busy ? "CHWILĘ…" : "WYŚLIJ TEST"}</button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.t}</p>}
      <MailQueueBox status={status} ready={ready} onDone={reload} />
      <MailDns />
      <MailLog />
    </section>
  );
}