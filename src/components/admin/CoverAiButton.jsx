import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Sparkles } from "lucide-react";

// Generuje okładkę AI (1 obraz na kliknięcie) i wstawia ją jako okładkę produktu.
export default function CoverAiButton({ form, onDone }) {
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    setBusy(true); setErr("");
    const res = await base44.functions.invoke("adminProducts", {
      action: "cover_ai", name: form.name, category: form.category,
      about: [form.promise, form.description].filter(Boolean).join(" "), hint,
    }).catch((e) => ({ data: { error: e?.response?.data?.error || e.message } }));
    setBusy(false);
    if (res.data?.url) onDone(res.data.url); else setErr(res.data?.error || "Nie udało się wygenerować");
  };

  return (
    <div className="space-y-2">
      <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Opcjonalnie: co ma być na okładce (np. świeca w ruinach)"
        className="w-full bg-transparent border hairline px-3 py-2 text-sm text-foreground" />
      <button type="button" onClick={go} disabled={busy} className="btn-ghost !px-4 !py-2 text-[10px] disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? "GENERUJĘ (DO 1 MIN)..." : "WYGENERUJ OKŁADKĘ AI"}
      </button>
      {err && <p className="text-xs blood-text">{err}</p>}
    </div>
  );
}