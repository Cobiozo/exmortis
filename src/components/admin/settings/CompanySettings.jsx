import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2 } from "lucide-react";
import { missingFirma } from "@/lib/firma";

const FIELDS = [["nazwa", "Nazwa firmy (pełna, jak w CEIDG)"], ["osoba", "Imię i nazwisko"], ["adres", "Adres działalności"], ["korespondencja", "Adres do korespondencji"],
  ["nip", "NIP"], ["regon", "REGON"], ["email", "E-mail kontaktowy"], ["telefon", "Telefon (opcjonalnie)"]];
const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Dane firmy: jedno miejsce dla Kontaktu, stopki, dokumentów prawnych, klauzul i e-maili.
export default function CompanySettings({ initial }) {
  const [f, setF] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qc = useQueryClient();
  const missing = missingFirma(f);
  const save = async () => {
    setBusy(true); setMsg(null);
    await base44.functions.invoke("adminSettings", { action: "save", target: "firma", data: f })
      .then(() => { setMsg({ ok: true, text: "Zapisano. Dane są już na stronie." }); qc.invalidateQueries({ queryKey: ["siteSettings"] }); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
    setBusy(false);
  };
  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Building2 className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Dane firmy</h2></div>
      <p className="text-sm text-foreground/50 mb-6">Puste pola nie są pokazywane publicznie: cała linia z takim polem jest ukryta.</p>
      {missing.length > 0 && <p className="text-sm text-[#F5EFE1] bg-[#5C1A1B] border border-[#BC1E22] px-4 py-3 mb-6">Brakuje: {missing.join(", ")}.</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map(([k, l]) => (
          <label key={k} className="block"><span className="block technical text-[10px] text-foreground/60 mb-2">{l}</span>
            <input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inp} /></label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ DANE FIRMY"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}