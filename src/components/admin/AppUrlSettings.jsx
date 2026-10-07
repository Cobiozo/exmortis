import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Globe, Save } from "lucide-react";

// APP_URL — adres domeny aplikacji używany we wszystkich linkach w e-mailach i przekierowaniach płatności.
export default function AppUrlSettings({ initial }) {
  const [url, setUrl] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await base44.functions.invoke("adminSettings", { action: "save", target: "app", data: { url } });
      setMsg({ ok: true, text: "Zapisano. Nowe linki będą używać tego adresu." });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.error || "Nie udało się zapisać." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border hairline p-6 md:p-8 lg:col-span-2">
      <div className="flex items-center gap-3 mb-2">
        <Globe className="h-5 w-5 gold-text" />
        <h2 className="relic-heading text-xl">Adres aplikacji (APP_URL)</h2>
      </div>
      <p className="text-sm text-foreground/50 mb-6 leading-relaxed">
        Domena, z której korzystają wszystkie linki w e-mailach (potwierdzenia, przypomnienia, odwołania zapisów, dostęp do produktów)
        oraz powroty z płatności PayU. Po przeniesieniu na produkcję wpisz tu domenę docelową.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exmortis.pl"
          className="flex-1 min-h-[48px] bg-transparent border hairline px-4 focus:border-[#C9A24A] focus:outline-none text-base" />
        <button onClick={save} disabled={busy || !url.trim()} className="btn-relic disabled:opacity-50">
          <Save className="h-4 w-4" /> {busy ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
      {msg && <p className={`text-sm mt-3 ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</p>}
    </section>
  );
}