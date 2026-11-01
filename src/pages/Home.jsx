import React from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { HOME_BLOCKS } from "@/components/cms/homeDefault";
import { withRozdroza } from "@/components/cms/homeRozdroza";

// Strona główna — budowana z bloków edytowanych w „Treści stron”.
// Sekcja ROZDROŻA wchodzi kodem (withRozdroza), więc rekord CMS zostaje bez zmian.
export default function Home() {
  const page = usePublishedPage("home");
  if (page === undefined) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return <BlockRenderer blocks={withRozdroza(page?.bloki || HOME_BLOCKS)} />;
}