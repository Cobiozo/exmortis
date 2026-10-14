import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Przełącznik awaryjny: wyłączenie zdejmuje service workera i czyści jego cache u odwiedzających.
export default function OfflineAppSettings({ initial }) {
  const [f, setF] = useState(initial || { offline: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qc = useQueryClient();

  const save = async (next) => {
    setF(next);
    setBusy(true); setMsg(null);
    await base44.functions.invoke("adminSettings", { action: "save", target: "aplikacja", data: next })
      .then(() => { setMsg({ ok: true, text: "Zapisano." }); qc.invalidateQueries({ queryKey: ["siteSettings"] }); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
    setBusy(false);
  };

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Smartphone className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Aplikacja offline</h2></div>
      <p className="text-sm text-foreground/50 mb-6">
        Aplikacja na telefon (PWA): manifest i service worker. Strona zawsze ładuje się z sieci —
        kopia z pamięci wchodzi tylko przy braku połączenia. Wyłączenie zdejmuje service workera
        i czyści jego cache u odwiedzających.
      </p>
      <label className="flex items-center gap-3">
        <Switch checked={f.offline !== false} disabled={busy} onCheckedChange={(v) => save({ offline: v })} aria-label="Aplikacja offline włączona" />
        <span className="text-sm text-foreground/70">Aplikacja offline włączona</span>
      </label>
      {msg && <p className={`text-sm mt-6 ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</p>}
    </section>
  );
}