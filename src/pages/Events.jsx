import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import EventCard from "@/components/exmortis/events/EventCard";
import PastEvents from "@/components/exmortis/events/PastEvents";
import NoEvents from "@/components/exmortis/events/NoEvents";

const TABS = [
  { key: "all", label: "Wszystkie" },
  { key: "free", label: "Bezpłatne" },
  { key: "online", label: "Online" },
  { key: "onsite", label: "Stacjonarnie" },
];

// Strona /spotkania — nadchodzące wydarzenia, minione z nagraniami.
export default function Events() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    base44.functions.invoke("eventsPublic", { action: "tick" }).catch(() => {});
    base44.functions
      .invoke("eventsPublic", { action: "list" })
      .then((res) => setData(res.data))
      .catch(() => setData({ upcoming: [], past: [] }));
  }, []);

  const upcoming = data?.upcoming || [];
  const filtered = useMemo(() => {
    return upcoming.filter((ev) => {
      if (tab === "free") return Number(ev.price) === 0;
      if (tab === "online") return ev.format === "Online";
      if (tab === "onsite") return ev.format === "Stacjonarnie";
      return true;
    });
  }, [upcoming, tab]);

  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-20 px-5 md:px-10">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-6">SPOTKANIA</p>
          <h1 className="shop-heading text-4xl md:text-7xl text-[#F5EFE1] leading-tight">Spotkania</h1>
          <p className="mt-8 text-foreground/60 text-lg leading-relaxed max-w-2xl">
            Czasem trzeba po prostu posiedzieć razem. Tu znajdziesz spotkania otwarte, warsztaty i kręgi —
            online i w Rzeszowie.
          </p>
        </div>
      </section>

      {!data ? (
        <div className="px-5 md:px-10 pb-24 space-y-4 max-w-[900px] mx-auto">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-40 border hairline bg-[#0D0D0E] animate-pulse" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="px-5 pb-32 md:pb-40">
          <NoEvents />
        </div>
      ) : (
        <>
          <div className="px-5 md:px-10 pb-12">
            <div className="mx-auto max-w-[900px] flex flex-wrap gap-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`technical text-[10px] px-5 py-2.5 border transition-colors duration-300 ${
                    tab === t.key
                      ? "border-[#C9A24A] gold-text"
                      : "hairline text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  {t.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 md:px-10 pb-20 md:pb-24 space-y-6 max-w-[900px] mx-auto">
            {filtered.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-foreground/40 py-16">
                W tym filtrze nie ma teraz żadnych spotkań.
              </p>
            )}
          </div>
        </>
      )}

      <PastEvents events={data?.past || []} />
    </div>
  );
}