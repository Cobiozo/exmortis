import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SettingsCard, { LINK } from "./SettingsCard";
import DeleteAccountDialog from "./DeleteAccountDialog";

export default function YourDataCard({ me }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [err, setErr] = useState("");
  const download = async () => {
    setBusy(true); setErr("");
    let r;
    try {
      r = await base44.functions.invoke("mySettings", { action: "export" });
    } catch {
      setBusy(false); setErr("Nie udało się przygotować pliku. Spróbuj ponownie.");
      return;
    }
    setBusy(false);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    a.download = "moje-dane-exmortis.json";
    a.click();
  };

  return (
    <SettingsCard title="Twoje dane">
      <div className="flex flex-col sm:flex-row sm:gap-8">
        <button type="button" onClick={download} disabled={busy} className={`${LINK} gap-2`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Pobierz moje dane
        </button>
        <button type="button" onClick={() => setOpen(true)} className={`${LINK} !decoration-[#FF6B6B] text-[#FF6B6B]`}>Usuń konto</button>
      </div>
      {err && <p role="alert" className="text-sm text-[#FF6B6B] mt-3">{err}</p>}
      <DeleteAccountDialog me={me} open={open} onOpenChange={setOpen} />
    </SettingsCard>
  );
}