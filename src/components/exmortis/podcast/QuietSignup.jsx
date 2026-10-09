import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useSystemText from "@/content/useSystemText";

// Cichy zapis e-mail (Listy powrotu) — bez wyskakujących okienek.
export default function QuietSignup({ button, source, lead }) {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [consent, setConsent] = useState(false);
  const t = useSystemText();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await base44.functions.invoke("subscribeNewsletter", { email, source }); setOk(true); }
    catch { setErr("Nie udało się zapisać. Spróbuj ponownie."); }
    setBusy(false);
  };

  if (ok) return <p className="text-sm gold-text">{t("dz.listy")}</p>;
  return (
    <form onSubmit={submit} className="space-y-3 max-w-lg">
      {lead && <p className="text-sm text-foreground/60">{lead}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Twój e-mail" className="flex-1 bg-transparent border hairline px-4 py-3 text-sm focus:border-[#C9A24A] focus:outline-none" />
        <button disabled={busy} className="btn-relic !py-3 !px-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{button}</button>
      </div>
      <label className="flex gap-2 text-xs text-foreground/45"><input required type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#C9A24A]" />Zgadzam się na otrzymywanie wiadomości e-mail od exmortis. Mogę się wypisać w każdej chwili.</label>
      {err && <p className="text-xs blood-text">{err}</p>}
    </form>
  );
}