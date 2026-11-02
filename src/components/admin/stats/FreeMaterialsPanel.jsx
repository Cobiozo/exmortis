import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import FreeDailyBars from "./FreeDailyBars";
import FreeMaterialsTable from "./FreeMaterialsTable";
import { downloadFreeCsv } from "./freeCsv";

const RANGES = [7, 30, 90];

// Darmowe materiały: ile osób pobrało, ile zapisało się na Listy powrotu, ile plików wyszło z maila.
export default function FreeMaterialsPanel() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState(30);

  useEffect(() => {
    base44.functions.invoke("adminDashboard", { action: "free_stats" })
      .then((res) => setData(res.data))
      .catch(() => setData(false));
  }, []);

  if (data === null) return <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;
  if (data === false) return <p className="text-sm text-foreground/55">Nie udało się pobrać statystyk darmowych materiałów.</p>;

  const products = data.products || [];
  const sum = (k) => products.reduce((s, p) => s + (p[k] || 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="technical text-[11px] gold-text mb-2">DARMOWE MATERIAŁY · STATYSTYKI</p>
          <p className="text-sm text-foreground/70">
            Razem {sum("total")} zamówień · 7 dni: {sum("d7")} · 30 dni: {sum("d30")} · e-maile: {sum("emails")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`technical text-[10px] px-3 py-2 border ${range === r ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/55 hover:text-foreground/80"}`}>
              {r} DNI
            </button>
          ))}
          <button onClick={() => downloadFreeCsv(products)} className="technical text-[10px] px-3 py-2 border hairline text-foreground/70 hover:border-[#C9A24A] hover:text-[#C9A24A]">
            CSV
          </button>
        </div>
      </div>

      <div className="space-y-10">
        <FreeDailyBars series={data.series || []} range={range} />
        <FreeMaterialsTable products={products} />
        <p className="text-xs text-foreground/50">
          „PDF z maila” to wpisy w dzienniku Bezpieczeństwo → Pobrania PDF (bez IP): moment wygenerowania
          osobistej kopii wysłanej mailem, nie samo otwarcie pliku.
        </p>
      </div>
    </div>
  );
}