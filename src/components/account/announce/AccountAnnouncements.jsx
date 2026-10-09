import React, { useEffect, useState } from "react";
import AnnouncementCard from "./AnnouncementCard";
import { ann, ANN_SEEN } from "./annApi";

const KEY = "exm_ann_h";

// Ogłoszenia w Moim koncie: jedno naraz (Ważne, potem najnowsze), reszta pod „Więcej ogłoszeń”.
// Odświeżane co 5 minut. Wysokość z poprzedniej wizyty rezerwowana do wczytania (bez skoku układu).
export default function AccountAnnouncements({ items: forced }) {
  const [items, setItems] = useState(forced || null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (forced) return;
    const load = () => ann("mine").then((d) => {
      setItems(d.items);
      if (d.items.length) {
        ann("event", { type: "seen", ids: d.items.map((a) => a.id) }).then(() => window.dispatchEvent(new Event(ANN_SEEN)));
        ann("event", { type: "view", id: d.items[0].id });
      }
    }).catch(() => setItems([]));
    load();
    const t = setInterval(load, 300000);
    return () => clearInterval(t);
  }, [forced]);

  const list = forced || items;
  useEffect(() => { if (!forced && list) localStorage.setItem(KEY, list.length ? "1" : "0"); }, [list, forced]);
  if (!list) return localStorage.getItem(KEY) === "1" ? <div className="min-h-[150px]" aria-hidden="true" /> : null;
  if (!list.length) return null;

  const act = (a, type) => !forced && ann("event", { type, id: a.id });
  const dismiss = (a) => { act(a, "dismiss"); setItems((l) => l.filter((x) => x.id !== a.id)); };
  const expand = () => { setMore(true); list.slice(1).forEach((a) => act(a, "view")); };
  const shown = more ? list : list.slice(0, 1);

  return (
    <div className="space-y-4" aria-label="Ogłoszenia">
      {shown.map((a) => <AnnouncementCard key={a.id} a={a} onDismiss={() => dismiss(a)} onClick={() => act(a, "click")} />)}
      {!more && list.length > 1 && (
        <button type="button" onClick={expand} className="min-h-[44px] font-mono text-xs tracking-[0.14em] text-[#C9A24A] underline underline-offset-4 hover:text-[#E2C170] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
          Więcej ogłoszeń ({list.length - 1})
        </button>
      )}
    </div>
  );
}