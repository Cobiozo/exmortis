import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BTN_SECONDARY, FOCUS } from "./SettingsCard";

export default function DeleteAccountDialog({ me, open, onOpenChange }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = confirm.trim().toLowerCase() === me.email.toLowerCase();

  const del = async () => {
    setBusy(true); setErr("");
    const r = await base44.functions.invoke("mySettings", { action: "delete", confirm }).catch((e) => ({ data: e.response?.data || {} }));
    if (r.data.ok) return base44.auth.logout("/");
    setBusy(false); setErr(r.data.error || "Nie udało się usunąć konta.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0B] border border-[rgba(201,162,74,.25)] text-[#E2E2E2]">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase">Usunąć konto?</DialogTitle>
          <DialogDescription className="text-[#E2E2E2]/80 text-base space-y-2">
            Usuniemy konto, dostępy do produktów, zapisy, zgłoszenia, wyniki testu i subskrypcję Listów. Tego nie da się cofnąć. Zamówienia zostają w dokumentach księgowych przez 5 lat, zgodnie z przepisami.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="del-confirm" className="text-sm">Wpisz swój adres e-mail, aby potwierdzić:</label>
        <input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off"
          className={`min-h-[44px] bg-transparent border border-[#3D3D3F] px-4 ${FOCUS}`} />
        {err && <p role="alert" className="text-sm text-[#FF6B6B]">{err}</p>}
        <button type="button" onClick={del} disabled={!ok || busy}
          className={`${BTN_SECONDARY} !border-[#FF6B6B] !text-[#FF6B6B] hover:!bg-[#FF6B6B]/10`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Usuń konto na zawsze
        </button>
      </DialogContent>
    </Dialog>
  );
}