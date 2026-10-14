import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const sel = "w-full bg-[#0A0A0B] border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

const STAWKI = [["23", "23%"], ["22", "22%"], ["8", "8%"], ["7", "7%"], ["5", "5%"], ["4", "4%"], ["3", "3%"], ["0", "0%"], ["zw", "zw (zwolniona)"]];

// Automatyczne faktury w Fakturowni. Token API siedzi w sekretach aplikacji — tu tylko informacja, czy jest.
export default function FakturySettings({ initial }) {
  const [f, setF] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    await base44.functions.invoke("adminSettings", { action: "save", target: "faktury", data: f })
      .then(() => setMsg({ ok: true, text: "Zapisano. Faktury ruszą przy najbliższym opłaconym zamówieniu." }))
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
    setBusy(false);
  };

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><FileText className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Faktury (Fakturownia)</h2></div>
      <p className="text-sm text-foreground/50 mb-6">
        Po opłaceniu zamówienia faktura wystawia się sama w Fakturowni. Kupujący zobaczy ją w zakładce Zamówienia
        na koncie, a numer i link do PDF są też w panelu zamówień. Błąd wystawienia nigdy nie przerywa zamówienia —
        dokument można wystawić ponownie z panelu, a zaległe próbuje dokończyć zadanie cykliczne.
      </p>

      {!f.token_set && (
        <p className="flex items-start gap-2 text-sm text-[#E8C547] mb-6">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Brak tokenu API. Dopóki go nie ma, nic nie wysyłamy do Fakturowni — dodaj sekret <span className="font-mono">FAKTUROWNIA_API_TOKEN</span> (Fakturownia → Ustawienia → API).</span>
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Konto w Fakturowni (subdomena)</span>
          <input value={f.subdomena || ""} onChange={(e) => set("subdomena", e.target.value)} placeholder="exmortis" className={`${inp} font-mono`} />
          <span className="block text-xs text-foreground/45 mt-2">Z adresu {(f.subdomena || "twojekonto") + ".fakturownia.pl"}</span>
        </label>
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Domyślna stawka VAT</span>
          <select value={f.stawka || "23"} onChange={(e) => set("stawka", e.target.value)} className={sel}>
            {STAWKI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Osoba prywatna (bez NIP)</span>
          <select value={f.dokument_osoba || "vat"} onChange={(e) => set("dokument_osoba", e.target.value)} className={sel}>
            <option value="vat">Faktura VAT</option>
            <option value="zw">Faktura bez VAT (zwolniona)</option>
            <option value="nie">Nie wystawiaj automatycznie</option>
          </select>
        </label>
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Firma (z NIP)</span>
          <select value={f.dokument_firma || "vat"} onChange={(e) => set("dokument_firma", e.target.value)} className={sel}>
            <option value="vat">Faktura VAT</option>
            <option value="zw">Faktura bez VAT (zwolniona)</option>
          </select>
        </label>
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Stawka dla treści cyfrowych (e-book, audio, wideo, kurs)</span>
          <select value={f.stawka_cyfrowe || ""} onChange={(e) => set("stawka_cyfrowe", e.target.value)} className={sel}>
            <option value="">Taka jak domyślna</option>
            {STAWKI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="block text-xs text-foreground/45 mt-2">Karty podarunkowe zawsze idą jako bon, stawką „np” (nie podlega VAT).</span>
        </label>
        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-3">
            <Switch checked={!!f.wlaczona} onCheckedChange={(v) => set("wlaczona", v)} aria-label="Automatyczne faktury włączone" />
            <span className="text-sm text-foreground/70">Automatyczne faktury włączone</span>
          </label>
          <label className="flex items-center gap-3">
            <Switch checked={f.wyslij_email !== false} onCheckedChange={(v) => set("wyslij_email", v)} aria-label="Wysyłaj dokument e-mailem" />
            <span className="text-sm text-foreground/70">Wyślij dokument e-mailem z Fakturowni</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-6">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ FAKTURY"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</span>}
      </div>
      <p className="text-xs text-foreground/45 mt-4">
        Zakres i kolejność prac po stronie księgowości i obsługi danych: <span className="font-mono">docs/faktury_fakturownia.md</span>.
      </p>
    </section>
  );
}