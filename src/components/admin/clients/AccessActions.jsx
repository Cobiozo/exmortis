import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AccessActions({ a, onDone }) {
  const [months, setMonths] = useState("12");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const run = async (action) => {
    setBusy(true);
    await base44.functions.invoke("adminClients", { action, access_id: a.id, months });
    setBusy(false); setConfirm(false); onDone();
  };

  if (busy) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;
  return (
    <div className="flex items-center gap-2">
      <input type="number" min="1" max="60" value={months} onChange={(e) => setMonths(e.target.value)} className="w-16 bg-[#0A0A0B] border hairline px-2 py-1.5 text-xs" />
      <button onClick={() => run("extend")} className="btn-ghost !px-3 !py-1.5 text-[10px]">+ MIES.</button>
      {a.revoked ? (
        <button onClick={() => run("restore")} className="btn-ghost !px-3 !py-1.5 text-[10px]">PRZYWRÓĆ</button>
      ) : confirm ? (
        <button onClick={() => run("revoke")} className="btn-blood !px-3 !py-1.5 text-[10px]">NA PEWNO ODBIERZ</button>
      ) : (
        <button onClick={() => setConfirm(true)} className="btn-ghost !px-3 !py-1.5 text-[10px]">ODBIERZ</button>
      )}
    </div>
  );
}