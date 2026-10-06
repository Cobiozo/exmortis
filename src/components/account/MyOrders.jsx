import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { plDate, STATUS_LABEL } from "./accountUtils";

export default function MyOrders() {
  const [list, setList] = useState(null);
  useEffect(() => {
    base44.functions.invoke("myAccount", { action: "orders" }).then((r) => setList(r.data.orders));
  }, []);

  if (!list) return <p className="text-foreground/50">Ładowanie…</p>;
  if (!list.length) return <p className="text-foreground/50 py-10">Nie masz jeszcze zamówień.</p>;
  return (
    <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
      {list.map((o) => (
        <div key={o.id} className="py-5 grid sm:grid-cols-4 gap-2 sm:gap-6 text-sm">
          <span className="text-foreground/50">{plDate(o.created_date)}</span>
          <span className="sm:col-span-2 text-[#F5EFE1]">{(o.items || []).map((i) => i.name).join(", ")}</span>
          <span className="sm:text-right">
            <span className="font-mono gold-text">{Number(o.total).toFixed(2)} zł</span>
            <span className="block technical text-[9px] text-foreground/45 mt-1">{STATUS_LABEL[o.status] || o.status}</span>
          </span>
        </div>
      ))}
    </div>
  );
}