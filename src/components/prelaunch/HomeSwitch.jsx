import React from "react";
import lazyPage from "@/lib/lazyPage";

// Strona główna (opublikowana w edytorze). W czasie przerwy technicznej gość widzi stronę przerwy (PrelaunchGate).
const Home = lazyPage(() => import("@/pages/Home"));
import usePrelaunch from "@/lib/usePrelaunch";
import JsonLd from "@/components/seo/JsonLd";
import { orgJsonLd } from "@/lib/structuredData";
import { useSiteNav } from "@/components/exmortis/nav/useSiteNav";

export default function HomeSwitch() {
  const { loading } = usePrelaunch();
  const { kolumny } = useSiteNav();
  // Linki społecznościowe z ustawień stopki — tylko one wchodzą do sameAs.
  const social = (kolumny || []).flatMap((c) => (c.links || []).map((l) => l.to));
  if (loading) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return (
    <>
      <JsonLd data={orgJsonLd(social)} />
      <Home />
    </>
  );
}
