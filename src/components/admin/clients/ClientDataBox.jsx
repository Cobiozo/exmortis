import React, { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// RODO w karcie klienta: wydanie danych (JSON) i usunięcie danych (kaskadowo, z anonimizacją rejestru).
export default function ClientDataBox({ email, onDone }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ask, setAsk] = useState(false);

  const call = async (action, extra = {}) => {
    setBusy(action); setErr(""); setMsg("");
    const r = await base44.functions.invoke("gdprPerson", { action, email, ...extra })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setBusy("");
    return r.data;
  };

  const exportData = async () => {
    const d = await call("export");
    if (d.error) return setErr(d.error);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
    a.download = `dane-${email}.json`;
    a.click();
    setMsg("Dane wyeksportowane.");
  };

  const remove = async () => {
    const d = await call("delete", { confirm });
    if (d.error) return setErr(d.error);
    setAsk(false); setConfirm("");
    setMsg(`Usunięte rekordy: ${d.removed ? Object.values(d.removed).reduce((a, b) => a + b, 0) : 0}. Konto: ${d.konto}.`);
    onDone?.();
  };

  return (
    <section className="border hairline p-5 space-y-4">
      <p className="technical text-[10px] gold-text">DANE OSOBOWE (RODO)</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={exportData} disabled={!!busy} className="btn-ghost !py-3 text-[10px]">
          {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} EKSPORTUJ DANE (JSON)
        </button>
        <button onClick={() => { setAsk(!ask); setMsg(""); setErr(""); }} disabled={!!busy} className="btn-ghost !py-3 text-[10px]">
          <Trash2 className="h-4 w-4" /> USUŃ DANE KLIENTA
        </button>
      </div>
      {ask && (
        <div className="space-y-3 border-t hairline pt-4">
          <p className="text-xs text-foreground/60">
            Usunięcie jest nieodwracalne: rezerwacje, pakiety, odpowiedzi z formularza i powiązania. Dowody zgód i zamówienia zostają (obowiązek prawny), a wpis w rejestrze zostaje zanonimizowany.
          </p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Wpisz ${email}, aby potwierdzić`}
            className="w-full bg-transparent border hairline px-3 py-2 text-sm focus:border-[#BC1E22] outline-none" />
          <button onClick={remove} disabled={busy === "delete" || confirm.toLowerCase() !== email.toLowerCase()}
            className="btn-blood !py-3 text-[10px] disabled:opacity-40">
            {busy === "delete" ? "USUWAM…" : "POTWIERDZAM USUNIĘCIE"}
          </button>
        </div>
      )}
      {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
    </section>
  );
}