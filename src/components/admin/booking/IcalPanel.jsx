import React, { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { bk, plDateTime } from "./api";

// MUSI 6: najpierw prywatny kanał iCal — tajny adres, obrót, w treści tylko rodzaj i imię.
export default function IcalPanel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const load = () => bk("ical").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const rotate = async () => {
    if (!window.confirm("Obrócić adres? Stary przestanie działać i trzeba go podmienić w kalendarzu.")) return;
    setErr("");
    try { setD(await bk("ical", { rotate: true })); } catch (e) { setErr(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr("Skopiuj ręcznie."); }
  };

  if (!d) return err ? <p className="text-sm text-[#E8C547]">{err}</p> : null;
  return (
    <section className="border hairline p-5 space-y-3">
      <p className="technical text-[10px] gold-text">KANAŁ iCAL (PRYWATNY)</p>
      <p className="text-xs text-foreground/50">
        Dodaj ten adres jako subskrypcję w swoim kalendarzu. W treści jest wyłącznie rodzaj spotkania i imię — bez adresów i bez odpowiedzi z formularza.
      </p>
      <div className="flex flex-wrap gap-2">
        <code className="flex-1 min-w-[240px] text-[11px] break-all bg-[#0F0F10] border hairline px-3 py-2">{d.url}</code>
        <button onClick={copy} className="btn-ghost !py-2 text-[10px]"><Copy className="h-3 w-3" /> {copied ? "SKOPIOWANE" : "KOPIUJ"}</button>
        <button onClick={rotate} className="btn-ghost !py-2 text-[10px]"><RefreshCw className="h-3 w-3" /> OBRÓĆ</button>
      </div>
      {d.rotated_at && <p className="text-[11px] text-foreground/40">Ostatnia zmiana adresu: {plDateTime(d.rotated_at)}</p>}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
    </section>
  );
}