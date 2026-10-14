import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { plDate, STATUS_LABEL } from "./accountUtils";

export default function MyOrders() {
  const [list, setList] = useState(null);
  const [cards, setCards] = useState([]);
  useEffect(() => {
    base44.functions.invoke("myAccount", { action: "orders" }).then((r) => { setList(r.data.orders); setCards(r.data.gift_cards || []); });
  }, []);

  if (!list) return <p className="text-foreground/50">Ładowanie…</p>;
  if (!list.length) return <p className="text-foreground/50 py-10">Nie masz jeszcze zamówień.</p>;
  return (
    <div className="space-y-10">
    {cards.length > 0 && (
      <section>
        <p className="technical text-[10px] text-foreground/50 mb-3">KARTY PODARUNKOWE</p>
        <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
          {cards.map((c) => (
            <div key={c.token} className="py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-mono gold-text">{Number(c.value).toFixed(2).replace(".", ",").replace(",00", "")} zł</span>
              <span className="text-[#F5EFE1] flex-1 min-w-[8rem] break-words">{c.to_name ? `dla ${c.to_name}` : "Karta podarunkowa"}</span>
              <span className="technical text-[9px] text-foreground/45">{c.used ? "WYKORZYSTANA" : `WAŻNA DO ${plDate(c.until).toUpperCase()}`}</span>
              <a href={`/karta#t=${c.token}`} target="_blank" rel="noopener noreferrer" className="technical text-[10px] gold-text">OTWÓRZ KARTĘ</a>
            </div>
          ))}
        </div>
      </section>
    )}
    <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
      {list.map((o) => (
        <div key={o.id} className="py-5 grid sm:grid-cols-4 gap-2 sm:gap-6 text-sm">
          <span className="text-foreground/50">{plDate(o.created_date)}<span className="block technical text-[9px] text-foreground/35 mt-1">NR {String(o.id).slice(0, 8).toUpperCase()}</span></span>
          <span className="sm:col-span-2 text-[#F5EFE1]">{(o.items || []).map((i) => i.name).join(", ")}</span>
          <span className="sm:text-right">
            <span className="font-mono gold-text">{Number(o.total).toFixed(2).replace(".", ",")} zł</span>
            <span className="block technical text-[9px] text-foreground/45 mt-1">{STATUS_LABEL[o.status] || o.status}</span>
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}