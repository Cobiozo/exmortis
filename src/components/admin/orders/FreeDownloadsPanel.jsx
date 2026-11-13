import React, { useEffect, useRef, useState } from "react";
import { Loader2, Download, Search, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

const when = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const what = (items) => (Array.isArray(items) ? items.map((i) => i?.name).filter(Boolean).join(", ") : "") || "—";

// CSV (średnik + BOM — otwiera się poprawnie w Excelu).
function exportCsv(rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Data", "Imię", "E-mail", "Materiał", "Listy powrotu"];
  const body = rows.map((r) => [when(r.created_date), r.buyer_name, r.buyer_email, what(r.items), r.newsletter ? "tak" : "nie"]);
  const csv = "﻿" + [head, ...body].map((r) => r.map(cell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `darmowe_pobrania_exmortis_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Panel → Zamówienia → Darmowe pobrania: kto pobrał który darmowy materiał i kiedy.
export default function FreeDownloadsPanel() {
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    const t = setTimeout(() => {
      setErr("");
      base44.functions.invoke("adminOrders", { action: "free", q })
        .then((r) => { if (my === seq.current) setData(r.data); })
        .catch((e) => { if (my === seq.current) setErr(e?.response?.data?.error || "Nie udało się wczytać pobrań."); });
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const s = data?.summary || {};
  const rows = data?.downloads || [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#3D3D3F]/40 border hairline">
        {[["Pobrania łącznie", s.total], ["Ostatnie 30 dni", s.d30], ["Osoby (unikalne e-maile)", s.people], ["Zapis na Listy przy pobraniu", s.newsletter]].map(([k, v]) => (
          <div key={k} className="bg-[#0A0A0B] p-5">
            <p className="technical text-[9px] text-foreground/45">{k.toUpperCase()}</p>
            <p className="font-mono text-xl sm:text-2xl gold-text mt-2">{data ? v ?? 0 : "…"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj: e-mail, imię, materiał" aria-label="Szukaj pobrań"
            className="w-full bg-transparent border hairline pl-9 pr-3 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none" />
        </div>
        <button onClick={() => exportCsv(rows)} disabled={!rows.length} className="btn-ghost !px-4 !py-2.5 text-[10px] disabled:opacity-40">
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {err ? <p className="text-sm text-[#E8C547]">{err}</p> : !data ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : rows.length === 0 ? (
        <p className="text-sm text-foreground/50 py-10">Brak pobrań{q ? " dla tego wyszukiwania" : ""}.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[150px_1fr_1fr_auto] gap-1 sm:gap-4 px-5 py-4 items-center">
              <span className="text-xs text-foreground/50">{when(r.created_date)}</span>
              <span className="min-w-0">
                <span className="block text-sm text-[#F5EFE1] truncate">{r.buyer_name || "—"}{r.is_test ? " · TEST" : ""}</span>
                <span className="block text-xs text-foreground/50 truncate">{r.buyer_email}</span>
              </span>
              <span className="text-sm text-foreground/75 min-w-0 truncate">{what(r.items)}</span>
              <span className="technical text-[9px] text-foreground/50 flex items-center gap-1.5 whitespace-nowrap">
                {r.newsletter ? <><Check className="h-3.5 w-3.5 text-[#9FD3A0]" /> LISTY POWROTU</> : "BEZ ZAPISU NA LISTY"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
