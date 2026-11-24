import React, { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Okładka nagrania audio: widoczna w odtwarzaczu na koncie klienta i na ekranie blokady telefonu.
export default function LessonCover({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onChange(file_url);
    } catch {
      setErr("Nie udało się wgrać okładki.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {value
        ? <img src={value} alt="Okładka nagrania" className="h-16 w-16 rounded object-cover border hairline" />
        : <span className="grid h-16 w-16 place-items-center rounded border hairline text-foreground/40"><ImagePlus className="h-5 w-5" /></span>}
      <label className="btn-ghost cursor-pointer !px-3 !py-2 text-[10px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {value ? "Zmień okładkę" : "Dodaj okładkę"}
        <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={busy} />
      </label>
      {value && <button type="button" onClick={() => onChange("")} className="text-xs text-foreground/50 underline hover:text-[#E8C547]">usuń okładkę</button>}
      <span className="text-xs text-foreground/50">Kwadrat, np. 1000 × 1000 px.</span>
      {err && <p className="w-full text-xs text-[#E8C547]">{err}</p>}
    </div>
  );
}