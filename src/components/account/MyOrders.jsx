import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { plDate, STATUS_LABEL } from "./accountUtils";
import ReviewButton from "./reviews/ReviewButton";

export default function MyOrders() {
  const [list, setList] = useState(null);
  const [cards, setCards] = useState([]);
  const [reviews, setReviews] = useState({});

  // Produkty z zamówień opłaconych co najmniej 7 dni temu, które można ocenić.
  const loadReviews = () => {
    base44.functions
      .invoke("reviews", { action: "mine" })
      .then((r) => setReviews(Object.fromEntries((r.data.items || []).map((i) => [`${i.order_id}:${i.product_id}`, i]))))
      .catch(() => setReviews({}));
  };

  useEffect(() => {
    base44.functions.invoke("myAccount", { action: "orders" }).then((r) => { setList(r.data.orders); setCards(r.data.gift_cards || []); });
    loadReviews();
  }, []);

  if (!list) return <p className="text-foreground/55">Ładowanie…</p>;
  if (!list.length) return <p className="text-foreground/55 py-10">Nie masz jeszcze zamówień.</p>;
  return (
    <div className="space-y-10">
    {cards.length > 0 && (
      <section>
        <p className="technical text-[10px] text-foreground/55 mb-3">KARTY PODARUNKOWE</p>
        <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
          {cards.map((c) => (
            <div key={c.token} className="py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-mono gold-text">{Number(c.value).toFixed(2).replace(".", ",").replace(",00", "")} zł</span>
              <span className="text-[#F5EFE1] flex-1 min-w-[8rem] break-words">{c.to_name ? `dla ${c.to_name}` : "Karta podarunkowa"}</span>
              <span className="technical text-[9px] text-foreground/55">{c.used ? "WYKORZYSTANA" : `WAŻNA DO ${plDate(c.until).toUpperCase()}`}</span>
              <a href={`/karta#t=${c.token}`} target="_blank" rel="noopener noreferrer" className="technical text-[10px] gold-text">OTWÓRZ KARTĘ</a>
            </div>
          ))}
        </div>
      </section>
    )}
    <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
      {list.map((o) => (
        <div key={o.id} className="py-5 grid sm:grid-cols-4 gap-2 sm:gap-6 text-sm">
          <span className="text-foreground/55">{plDate(o.created_date)}<span className="block technical text-[9px] text-foreground/55 mt-1">NR {String(o.id).slice(0, 8).toUpperCase()}</span></span>
          <div className="sm:col-span-2 text-[#F5EFE1] space-y-2">
            {(o.items || []).map((i, k) => (
              <div key={k} className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span>{i.name}</span>
                  {reviews[`${o.id}:${i.product_id}`] && (
                    <ReviewButton item={{ ...reviews[`${o.id}:${i.product_id}`], product_name: i.name }} onSaved={loadReviews} />
                  )}
                </div>
                {Array.isArray(i.components) && i.components.length > 0 && (
                  <p className="text-xs text-foreground/55">W pakiecie: {i.components.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
          <span className="sm:text-right">
            <span className="font-mono gold-text">{Number(o.total).toFixed(2).replace(".", ",")} zł</span>
            <span className="block technical text-[9px] text-foreground/55 mt-1">{STATUS_LABEL[o.status] || o.status}</span>
            {o.invoice_url && (
              <a href={o.invoice_url} target="_blank" rel="noopener noreferrer" className="block technical text-[9px] gold-text mt-1 underline">
                POBIERZ FAKTURĘ{o.invoice_number ? ` ${o.invoice_number}` : ""}
              </a>
            )}
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}