import React, { useState } from "react";
import { Upload, Loader2, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TYPES = [
  ["pdf", "PDF"],
  ["audio", "Audio"],
  ["wideo", "Wideo"],
  ["kurs", "Kurs wideo"],
  ["usluga", "Usługa / spotkanie"],
];
const inputCls = "w-full bg-[#0A0A0B] border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const labelCls = "technical text-[10px] text-foreground/50 block mb-2";

// Typ produktu, czas dostępu i prywatny plik (PDF / audio) dla „Moich produktów”.
export default function ProductAccessFields({ form, set }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const digital = form.product_type !== "usluga";

  const changeType = (t) => {
    set("product_type", t);
    set("access_months", t === "wideo" || t === "kurs" ? "12" : "");
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      set("private_file_uri", file_uri);
      set("private_file_name", file.name);
    } catch {
      setErr("Nie udało się wgrać pliku. PDF do 10 MB, audio do 100 MB.");
    }
    setBusy(false);
  };

  return (
    <div className="mb-10 space-y-6">
      <p className="technical text-[10px] gold-text">TYP PRODUKTU I DOSTĘP NA KONCIE</p>
      <div className="grid md:grid-cols-2 gap-6">
        <label>
          <span className={labelCls}>TYP</span>
          <select value={form.product_type} onChange={(e) => changeType(e.target.value)} className={inputCls}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {digital && (
          <label>
            <span className={labelCls}>CZAS DOSTĘPU (MIESIĄCE, PUSTE = BEZTERMINOWO)</span>
            <input type="number" min="1" max="120" value={form.access_months} onChange={(e) => set("access_months", e.target.value)} className={inputCls} />
          </label>
        )}
      </div>
      {(form.product_type === "pdf" || form.product_type === "audio") && (
        <div className="space-y-3">
          <label className="btn-ghost cursor-pointer !px-4 !py-2 text-[10px]">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" strokeWidth={1.25} />}
            {form.private_file_uri ? "ZAMIEŃ PLIK PRYWATNY" : "WGRAJ PLIK PRYWATNY"}
            <input type="file" className="hidden" accept={form.product_type === "pdf" ? ".pdf" : ".mp3,.m4a"} onChange={upload} />
          </label>
          {form.private_file_uri && (
            <p className="flex items-center gap-2 text-xs text-foreground/60">
              <Lock className="h-3.5 w-3.5 gold-text" strokeWidth={1.25} /> {form.private_file_name || "plik"}
              <button type="button" onClick={() => { set("private_file_uri", ""); set("private_file_name", ""); }} className="technical text-[10px] text-foreground/40 hover:blood-text ml-3">USUŃ</button>
            </p>
          )}
          {!form.private_file_uri && !form.is_free && (
            <p className="text-xs text-[#E8C547]">Płatny produkt cyfrowy potrzebuje pliku, zanim klient go odbierze.</p>
          )}
          {err && <p className="text-xs text-[#E8C547]">{err}</p>}
          <p className="text-xs text-foreground/40">Plik jest prywatny — klient pobiera go wyłącznie ze swojego konta, przez link ważny 10 minut.</p>
        </div>
      )}
    </div>
  );
}