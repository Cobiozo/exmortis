import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import EventTile from "@/components/exmortis/events/EventTile";
import PastEvents from "@/components/exmortis/events/PastEvents";
import NoEvents from "@/components/exmortis/events/NoEvents";

const TABS = [["all", "Wszystkie"], ["free", "Bezpłatne"], ["online", "Online"], ["onsite", "Stacjonarnie"]];

// Moduł: nadchodzące spotkania z filtrami i minione z nagraniami (dane z modułu Spotkania).
export default function EventsListing() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");
  useEffect(() => {
    base44.functions.invoke("eventsPublic", { action: "tick" }).catch(() => {});
    base44.functions.invoke("eventsPublic", { action: "list" }).then((res) => setData(res.data)).catch(() => setData({ upcoming: [], past: [] }));
  }, []);
  const upcoming = data?.upcoming || [];
  const publishedCount = upcoming.filter((e) => e.status === "Opublikowane").length;
  const filtered = useMemo(() => upcoming.filter((ev) => {
    if (tab === "free") return Number(ev.price) === 0;
    if (tab === "online") return ev.format === "Online";
    if (tab === "onsite") return ev.format === "Stacjonarnie";
    return true;
  }), [upcoming, tab]);

  return (
    <div className="bg-[#0A0A0B]">
      {!data ? (
        <div className="px-5 md:px-10 pb-24 space-y-4 max-w-[900px]">
          {[0, 1].map((i) => <div key={i} className="h-40 border border-[#2A2A2A] bg-[#121212] animate-pulse" />)}
        </div>
      ) : publishedCount === 0 ? (
        <div className="px-5 md:px-10 pb-32 md:pb-40 max-w-[900px]"><NoEvents /></div>
      ) : (
        <>
          <div className="px-5 md:px-10 pb-10">
            <div className="mx-auto max-w-[1400px] flex flex-wrap gap-3">
              {TABS.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`technical text-[10px] px-5 py-2.5 border transition-colors duration-300 ${tab === k ? "border-[#C9A24A] gold-text" : "border-[#2A2A2A] text-foreground/40 hover:text-foreground/70"}`}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="px-5 md:px-10 pb-20 md:pb-24 mx-auto max-w-[1400px] grid gap-5 min-[641px]:grid-cols-2 min-[1101px]:grid-cols-3 items-stretch">
            {filtered.map((ev) => <EventTile key={ev.id} event={ev} />)}
            {filtered.length === 0 && <p className="text-foreground/40 py-16 col-span-full">W tym filtrze nie ma teraz żadnych spotkań.</p>}
          </div>
        </>
      )}
      <PastEvents events={data?.past || []} />
    </div>
  );
}