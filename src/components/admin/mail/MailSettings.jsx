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

// Status profilu newslettera (osobna konfiguracja, np. Brevo).
function useMarketingStatus(enabled) {
  const [status, setStatus] = useState(null);
  const reload = () => base44.functions.invoke("mailAdmin", { action: "status", profile: "marketing" })
    .then((r) => setStatus(r.data)).catch(() => setStatus({ ready: false, config: {} }));
  useEffect(() => { if (enabled) reload(); }, [enabled]);
  return { status, ready: !!status?.ready, reload };
}

// Ustawienia → Wysyłka e-mail. profile="marketing" — osobny kanał dla Listów powrotu i ogłoszeń.
export default function MailSettings({ profile = "main" }) {
  const mkt = profile === "marketing";
  const main = useMailStatus();
  const m = useMarketingStatus(mkt);
  const { status, ready, reload } = mkt ? m : main;
  const [f, setF] = useState(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (status && !f) setF({ port: "587", from_name: "exmortis", ...Object.fromEntries(Object.entries(status.config || {}).filter(([, v]) => v)) }); }, [status, f]);

  const run = async (action, data) => {
    setBusy(true); setMsg(null);
    const r = await base44.functions.invoke("mailAdmin", { action, ...data, ...(mkt ? { profile: "marketing" } : {}) }).catch((e) => ({ data: { ok: false, error: e?.response?.data?.error || e.message } }));
    setBusy(false);
    if (action === "save") setMsg(r.data?.ok ? { ok: true, t: "Zapisano. Wyślij test, aby włączyć wysyłkę." } : { ok: false, t: r.data?.error });
    if (action === "test") setMsg(r.data?.ok ? { ok: true, t: "Test wysłany. Wysyłka DZIAŁA." } : { ok: false, t: `Błąd: ${r.data?.error}` });
    reload();
  };

  if (!status || !f) return <section className="border hairline p-8"><p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p></section>;
  return (
    <section className="border hairline p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="relic-heading text-xl">{mkt ? "Wysyłka newslettera (Listy powrotu)" : "Wysyłka e-mail"}</h2>
        <span className={`technical text-[10px] px-3 py-1 border ${ready ? "border-[#C9A24A] gold-text" : "border-foreground/30 text-foreground/50"}`}>{ready ? "DZIAŁA" : mkt ? "NIEUSTAWIONA — LISTY IDĄ ZWYKŁĄ SKRZYNKĄ" : "NIESKONFIGUROWANA"}</span>
      </div>
      {mkt ? (
        <p className="text-sm text-foreground/60 max-w-3xl leading-relaxed">
          Osobny serwis do wysyłki masowej (np. Brevo: Ustawienia → SMTP i API → klucz SMTP; host smtp-relay.brevo.com, port 587).
          Gdy działa, Listy powrotu i ogłoszenia idą przez niego, a skrzynka Simply zostaje dla zamówień, zapisów i linków do spotkań —
          Simply nie pozwala wysyłać newsletterów zwykłą skrzynką, a jej blokada zatrzymałaby też maile z zamówień.
          Adres nadawcy (np. listy@exmortis.pl) musi być zweryfikowany w Brevo, a w DNS domeny dodane rekordy DKIM od Brevo.
        </p>
      ) : (
        <p className="text-sm text-foreground/60 max-w-3xl leading-relaxed">Zamówienia, zapisy, przypomnienia, linki do spotkań i odpowiedzi — jedna skrzynka nadawcy. Najwyżej 240 maili na 2 godziny (limit Simply), nadwyżka czeka i wychodzi sama.</p>
      )}
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
      {!mkt && <MailQueueBox status={status} ready={ready} onDone={reload} />}
      {!mkt && <MailDns />}
      {!mkt && <MailLog />}
    </section>
  );
}