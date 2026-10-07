import React from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { HOME_BLOCKS } from "@/components/cms/homeDefault";

// Strona główna — budowana z bloków edytowanych w „Treści stron”.
export default function Home() {
  const page = usePublishedPage("home");
  if (page === undefined) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return <BlockRenderer blocks={page?.bloki || HOME_BLOCKS} />;
}