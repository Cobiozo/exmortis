import React, { useCallback, useEffect, useState } from "react";
import { bk } from "./api";

// Pakiety klientów. „ODDAJ SESJĘ” obsługuje politykę „decyduje admin” przy późnym odwołaniu.
export default function PackagesPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => bk("packages").then((d) => setRows(d.packages)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const give = async (p) => {
    setBusy(p.id); setErr("");
    try { await bk("return_session", { package_id: p.id, note: "oddanie sesji w panelu" }); await load(); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };

  if (err && !rows) return <p className="blood-text text-sm">{err}</p>;
  if (!rows) return <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />;
  if (!rows.length) return <p className="text-sm text-foreground/50">Brak pakietów.</p>;

  return (
    <div className="space-y-3">
      {err && <p className="blood-text text-sm">{err}</p>}
      {rows.map((p) => (
        <div key={p.id} className="border hairline p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm">{p.type} · {p.email || "—"}</p>
            <p className="text-xs text-foreground/50">
              Wykorzystane {p.sessions_used} / {p.sessions_total} · ważny do {new Date(p.valid_until).toLocaleDateString("pl-PL")} · {p.source}
              {p.order_id ? ` · zamówienie ${String(p.order_id).slice(0, 8)}` : ""}
            </p>
          </div>
          <button onClick={() => give(p)} disabled={busy === p.id || p.sessions_used === 0} className="btn-ghost text-[10px] disabled:opacity-40">
            {busy === p.id ? "ODDAJĘ…" : "ODDAJ SESJĘ"}
          </button>
        </div>
      ))}
    </div>
  );
}