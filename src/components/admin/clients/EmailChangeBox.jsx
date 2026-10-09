import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ecCall, EC_STATUS, downloadJson } from "./emailChangeApi";
import EmailChangePlan from "./EmailChangePlan";

// Klienci → osoba: „Zmień adres e-mail”, status procesu, tryb próbny, przeniesienie, kopia.
export default function EmailChangeBox({ email }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [plan, setPlan] = useState(null);
  const load = () => ecCall({ action: "state", email }).then(setS);
  useEffect(() => { load(); }, [email]);
  const run = async (k, p, ok) => {
    setBusy(k); setMsg("");
    const r = await ecCall(p);
    setBusy(""); setMsg(r.error || ok); if (!r.error) { setPlan(null); load(); }
    return r;
  };
  if (!s) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;
  const c = s.change;
  const active = c && ["wyslano", "podano", "przyjeto", "przenoszenie", "blad"].includes(c.status);
  const blocked = !s.mail || !s.on;

  return (
    <section className="border hairline p-5 space-y-3">
      <p className="technical text-[10px] gold-text">ADRES E-MAIL KONTA</p>
      {c && <p className="text-sm text-foreground/70">{EC_STATUS[c.status]}{c.new ? ` · nowy: ${c.new}` : ""} · {new Date(c.created_date).toLocaleString("pl-PL")}{c.blad ? ` · ${c.blad}` : ""}</p>}
      <div className="flex flex-wrap gap-3 items-center">
        {!active && <button disabled={blocked || !!busy} onClick={() => run("start", { action: "start", email }, "Wysłano link na obecny adres.")} className="btn-ghost !px-4 !py-2 disabled:opacity-40">ZMIEŃ ADRES E-MAIL</button>}
        {!active && blocked && <span className="technical text-[10px] text-foreground/40">{!s.on ? "FUNKCJA WYŁĄCZONA W USTAWIENIACH" : "WYMAGA SKONFIGUROWANEJ WYSYŁKI E-MAIL"}</span>}
        {c && ["przyjeto", "blad"].includes(c.status) && !plan && <button disabled={!!busy} onClick={async () => { setBusy("plan"); setPlan((await ecCall({ action: "plan", id: c.id })).plan); setBusy(""); }} className="btn-ghost !px-4 !py-2">CO ZOSTANIE PRZENIESIONE</button>}
        {c?.ma_kopie && <button onClick={async () => downloadJson(`kopia-${c.id}.json`, (await ecCall({ action: "backup", id: c.id })).kopia)} className="btn-ghost !px-4 !py-2">KOPIA (JSON)</button>}
        {c?.ma_kopie && c.status === "przeniesiono" && <button disabled={!!busy} onClick={() => window.confirm("Przywrócić stan sprzed przeniesienia?") && run("restore", { action: "restore", id: c.id }, "Przywrócono z kopii.")} className="btn-ghost !px-4 !py-2">PRZYWRÓĆ Z KOPII</button>}
        {busy && <Loader2 className="h-4 w-4 animate-spin gold-text" />}
      </div>
      {plan && <EmailChangePlan plan={plan} busy={busy === "transfer"} onTransfer={() => run("transfer", { action: "transfer", id: c.id }, "Przeniesiono. Stare konto zablokowane.")} />}
      {msg && <p className="text-sm gold-text">{msg}</p>}
    </section>
  );
}