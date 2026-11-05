import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import FunnelRows from "./FunnelRows";
import { testCounts, sumDays } from "@/lib/testCount";

const RANGES = [7, 30, 90];
const DAY = 86400000;
const inRange = (v, days) => {
  const t = Date.parse(v || 0);
  return !!t && t >= Date.now() - days * DAY;
};
const sum = (list, key) => list.reduce((s, x) => s + (Number(x[key]) || 0), 0);
const itemsOf = (raw) => {
  try {
    const j = Array.isArray(raw) ? raw : JSON.parse(raw || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
};
const isPowrot = (it) => /powrot/i.test(String(it.slug || it.product_id || it.name || ""));

// LEJEK — liczby z istniejących funkcji (adminDashboard, eventsAdmin, adminPowrot, adminOrders) i anonimowego
// licznika ukończeń testu (test_stats). Rozpoczęć testu nie liczymy — strona testu nie wysyła takich zdarzeń.
export default function FunnelPanel() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState(30);

  useEffect(() => {
    (async () => {
      const [quiz, free, events, powrot, orders] = await Promise.all([
        testCounts().catch(() => null),
        base44.functions.invoke("adminDashboard", { action: "free_stats" }).then((r) => r.data).catch(() => null),
        base44.functions.invoke("eventsAdmin", { action: "list" }).then((r) => r.data.events || []).catch(() => []),
        base44.functions.invoke("adminPowrot", { action: "list" }).then((r) => r.data.applications || []).catch(() => []),
        base44.functions.invoke("adminOrders", { action: "list", status: "paid" }).then((r) => r.data.orders || []).catch(() => []),
      ]);
      // Udział w spotkaniu: szczegóły (joined_at, status) po jednym odczycie na spotkanie z ostatnich 90 dni.
      const evs = events
        .filter((e) => e.start_datetime && inRange(e.start_datetime, 90) && (e.registered || 0) > 0)
        .slice(0, 40);
      const parts = await Promise.all(
        evs.map((e) =>
          base44.functions
            .invoke("eventsAdmin", { action: "get", id: e.id })
            .then((r) => r.data.participants || [])
            .catch(() => [])
        )
      );
      const joinedBy = {};
      evs.forEach((e, i) => {
        joinedBy[String(e.id)] = (parts[i] || []).filter((p) => !!p.joined_at || p.status === "Obecny").length;
      });
      setData({ quiz, free, events, joinedBy, powrot, orders });
    })();
  }, []);

  if (!data) return <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;

  const evsIn = data.events.filter((e) => e.start_datetime && inRange(e.start_datetime, range) && !/anulow/i.test(String(e.status || "")));
  const freeKey = `d${range}`;
  const rows = [
    { label: "Test ukończony (anonimowy licznik)", value: data.quiz ? sumDays(data.quiz, range) : null },
    { label: "Darmowy materiał (zamówienia 0 zł)", value: data.free ? sum(data.free.products || [], freeKey) : null },
    { label: "Zapis na spotkanie (registrations)", value: sum(evsIn, "registered") },
    { label: "Udział w spotkaniu (dołączył / Obecny)", value: evsIn.reduce((s, e) => s + (data.joinedBy[String(e.id)] || 0), 0) },
    { label: "Zgłoszenie POWRÓT", value: data.powrot.filter((a) => inRange(a.created_date, range)).length },
    { label: "Ankieta POWRÓT wypełniona", value: data.powrot.filter((a) => inRange(a.survey_done_at, range)).length },
    {
      label: "Sprzedaż POWRÓT (zamówienia opłacone)",
      value: data.orders.filter((o) => inRange(o.created_date, range) && itemsOf(o.items).some(isPowrot)).length,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="technical text-[11px] gold-text mb-2">LEJEK · POMIAR</p>
          <p className="text-sm text-foreground/70">Od pierwszego kliknięcia w test do kupionego POWROTU.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`technical text-[10px] px-3 py-2 border ${range === r ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/55 hover:text-foreground/80"}`}>
              {r} DNI
            </button>
          ))}
        </div>
      </div>

      <FunnelRows rows={rows} />

      <p className="text-xs text-foreground/50 mt-4">
        Zakres liczony od dziś wstecz ({range} dni). Test liczony po dniu ukończenia, spotkania po dacie rozpoczęcia,
        POWRÓT po dacie zgłoszenia i wypełnienia ankiety. Zdarzenia w GA4 i Meta wymagają zgody cookies i weryfikacji w DebugView.
      </p>
    </div>
  );
}