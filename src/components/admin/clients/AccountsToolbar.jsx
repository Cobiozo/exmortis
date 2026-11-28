import React from "react";
import { Download } from "lucide-react";
import { FilterChips, SearchField } from "@/components/admin/ui/kit";
import { FILTERS } from "./accountsUtils";

// Wyszukiwarka, filtry i eksport nad listą kont.
export default function AccountsToolbar({ q, onQ, filter, onFilter, counts, shown, onExport }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchField value={q} onChange={onQ} placeholder="Szukaj e-maila lub imienia" className="flex-1" />
        <button onClick={onExport} className="btn-ghost !px-4 !py-2.5 text-[10px] inline-flex items-center justify-center gap-2" title="Eksport CSV">
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>
      <FilterChips items={FILTERS.map((f) => [f.key, f.label])} value={filter} onChange={onFilter} label="Filtr kont" />
      <p className="text-xs text-foreground/45">
        Wyników: <span className="text-foreground/80">{shown}</span> z {counts?.total ?? "…"}
        {counts ? <span className="block mt-1 technical text-[9px] text-foreground/35">nowe (7 dni): {counts.new7} · logowania (7 dni): {counts.logins7}</span> : null}
      </p>
    </div>
  );
}