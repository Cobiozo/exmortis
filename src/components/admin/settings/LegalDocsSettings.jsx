import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Scale } from "lucide-react";
import { plDate } from "@/lib/legalFill";
import { renderAll } from "@/lib/legalRender";
import { useFirma } from "@/lib/useSiteSettings";

const FIELDS = [
  ["operator_nazwa", "Operator płatności — nazwa"], ["operator_adres", "Operator płatności — adres"],
  ["metody", "Metody płatności", "BLIK, Przelewy24, karta płatnicza"], ["przelozenie_h", "Termin przełożenia sesji (godziny)", "24"],
  ["data_od", "Data wejścia w życie", "np. 1 listopada 2026"], ["poczta", "Dostawca poczty e-mail"],
  ["newsletter", "Narzędzie do newslettera", "np. MailerLite"], ["biuro", "Biuro rachunkowe"],
];
const NAMES = { regulamin: "Regulamin", prywatnosc: "Polityka prywatności", cookies: "Polityka cookies" };
const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none placeholder:text-foreground/30";

// Dokumenty prawne → Dane do dokumentów. Zmiana pola = nowa wersja dokumentów, które go używają.
export default function LegalDocsSettings({ initial }) {
  const [d, setD] = useState(initial);
  const [f, setF] = useState(initial?.pola || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qc = useQueryClient();
  const firma = useFirma();
  const save = async (pola = f) => {
    setBusy(true); setMsg(null);
    await base44.functions.invoke("adminSettings", { action: "save", target: "dokumenty", data: pola, snapshots: renderAll(firma || {}, pola) })
      .then((r) => {
        setD(r.data.dokumenty);
        setMsg({ ok: true, text: r.data.created?.length ? `Zapisano. Nowe wersje: ${r.data.created.join(", ")}.` : "Zapisano. Treść bez zmian — wersje te same." });
        qc.invalidateQueries({ queryKey: ["siteSettings"] }); qc.invalidateQueries({ queryKey: ["legalVersions"] });
      })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
    setBusy(false);
  };
  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Scale className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Dokumenty prawne — dane do dokumentów</h2></div>
      <p className="text-sm text-foreground/50 mb-4">Puste pole = w dokumencie zostaje tekst w nawiasie. Każda zmiana gotowego tekstu (pole albo tekst dokumentu) tworzy nową wersję (+0.1) z pełną treścią w archiwum. Po zmianie tekstu w kodzie kliknij „Zapisz”, żeby utrwalić nową wersję.</p>
      <ul className="text-sm text-foreground/70 mb-6 space-y-1">
        {Object.entries(d?.docs || {}).map(([k, x]) => <li key={k}>{NAMES[k]}: wersja {x.version}{x.date && ` z ${plDate(x.date)}`}</li>)}
      </ul>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map(([k, l, ph]) => (
          <label key={k} className="block"><span className="block technical text-[10px] text-foreground/60 mb-2">{l}</span>
            <input value={f[k] || ""} placeholder={ph ? `[${ph}]` : "[w nawiasie]"} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inp} /></label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <button onClick={() => save()} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ DANE DO DOKUMENTÓW"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}