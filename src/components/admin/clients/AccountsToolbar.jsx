import React from "react";
import { Download, Search } from "lucide-react";
import { inputCls } from "@/components/admin/library/libApi";
import { FILTERS } from "./accountsUtils";

// Wyszukiwarka, filtry i eksport nad listą kont.
export default function AccountsToolbar({ q, onQ, filter, onFilter, counts, shown, onExport }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/35" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Szukaj e-maila lub imienia" className={`${inputCls} pl-9`} />
        </div>
        <button onClick={onExport} className="btn-ghost !px-4 !py-2 inline-flex items-center justify-center gap-2" title="Eksport CSV">
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={`technical text-[9px] px-3 py-2 border ${filter === f.key ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50 hover:text-foreground/80"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/45">
        Wyników: <span className="text-foreground/80">{shown}</span> z {counts?.total ?? "…"}
        {counts ? <span className="block mt-1 technical text-[9px] text-foreground/35">nowe (7 dni): {counts.new7} · logowania (7 dni): {counts.logins7}</span> : null}
      </p>
    </div>
  );
}