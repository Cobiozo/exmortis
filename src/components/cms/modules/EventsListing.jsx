import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import Container from "@/components/exmortis/ui/Container";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
import FeaturedEvent from "@/components/exmortis/events/FeaturedEvent";
import EventCard from "@/components/exmortis/events/EventCard";
import HowToJoin from "@/components/exmortis/events/HowToJoin";
import PastEvents from "@/components/exmortis/events/PastEvents";
import NoEvents from "@/components/exmortis/events/NoEvents";
import OneOnOne from "@/components/exmortis/events/OneOnOne";

// Filtry mają sens tylko wtedy, gdy naprawdę rozróżniają spotkania (nie pokazujemy filtra, który nic nie zmienia).
const FILTERS = [
  ["free", "Bezpłatne", (ev) => !(Number(ev.price) > 0)],
  ["online", "Online", (ev) => ev.format === "Online"],
  ["onsite", "Na żywo", (ev) => ev.format !== "Online"],
];

const PILL = "technical min-h-[40px] rounded-exm-pill border px-4 text-[11px] transition-colors";

// Moduł: najbliższe spotkanie jako szeroka karta, kolejne jako siatka, archiwum zwinięte.
export default function EventsListing() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    base44.functions
      .invoke("eventsPublic", { action: "list" })
      .then((res) => setData(res.data))
      .catch(() => setData({ upcoming: [], past: [] }));
  }, []);

  const upcoming = useMemo(() => data?.upcoming || [], [data]);
  const published = useMemo(() => upcoming.filter((e) => e.status === "Opublikowane"), [upcoming]);
  const filters = useMemo(
    () => FILTERS.filter(([, , match]) => published.some(match) && !published.every(match)),
    [published]
  );
  const filtered = useMemo(() => {
    const match = FILTERS.find(([key]) => key === tab)?.[2];
    return match ? upcoming.filter(match) : upcoming;
  }, [upcoming, tab]);

  const featured = tab === "all" ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  if (!data) {
    return (
      <div className="pt-10 md:pt-14">
        <Container>
          <SkeletonBlock className="h-[300px] w-full" rounded="var(--exm-r-card)" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-[360px] w-full" rounded="var(--exm-r-card)" />)}
          </div>
        </Container>
      </div>
    );
  }

  return (
    <>
      <div className="pt-10 md:pt-14">
        <Container>
          {published.length === 0 ? (
            <NoEvents />
          ) : (
            <>
              {featured && <FeaturedEvent ev={featured} />}

              {filters.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filtry spotkań">
                  {[["all", "Wszystkie"], ...filters.map(([key, label]) => [key, label])].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      aria-pressed={tab === key}
                      className={`${PILL} ${tab === key ? "border-exm-gold text-exm-gold" : "border-exm-line text-exm-muted hover:border-exm-line-strong hover:text-exm-text"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {rest.length > 0 ? (
                <div className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((ev) => <EventCard key={ev.id} ev={ev} />)}
                </div>
              ) : (
                featured && (
                  <p className="mt-8 max-w-[60ch] text-[15px] leading-relaxed text-exm-muted">
                    To jedyne zaplanowane spotkanie. Kolejne terminy ogłaszam najpierw w Listach powrotu.
                  </p>
                )
              )}
            </>
          )}
        </Container>
      </div>

      <PastEvents events={data.past || []} />
      <HowToJoin />
      <OneOnOne />
    </>
  );
}