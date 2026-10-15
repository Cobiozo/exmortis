import React from "react";
import lazyPage from "@/lib/lazyPage";
import Listopad from "@/pages/Listopad";

// Strona główna po premierze: ładowana na żądanie, żeby nie obciążała startu w trybie przedpremierowym.
const Home = lazyPage(() => import("@/pages/Home"));
import usePrelaunch from "@/lib/usePrelaunch";
import JsonLd from "@/components/seo/JsonLd";
import { orgJsonLd } from "@/lib/structuredData";
import { useSiteNav } from "@/components/exmortis/nav/useSiteNav";

// Strona główna: w trybie przedpremierowym gość widzi od razu stronę spotkania 1 listopada (/1-listopada).
export default function HomeSwitch() {
  const { gated, loading } = usePrelaunch();
  const { kolumny } = useSiteNav();
  // Linki społecznościowe z ustawień stopki — tylko one wchodzą do sameAs.
  const social = (kolumny || []).flatMap((c) => (c.links || []).map((l) => l.to));
  if (loading) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return (
    <>
      <JsonLd data={orgJsonLd(social)} />
      {gated ? <Listopad /> : <Home />}
    </>
  );
}