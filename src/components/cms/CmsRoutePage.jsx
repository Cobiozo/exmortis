import React from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { PAGE_DEFAULTS } from "@/components/cms/defaults/otherDefaults";

// Strony, które od razu (bez czekania na serwer) pokazują treść wbudowaną — strona spotkania 1 listopada
// jest zawsze wbudowana (bez publikacji z edytora), więc nic się nie podmienia, a pierwsza treść pojawia się szybciej.
const INSTANT = ["1-listopada"];

// Strona pod stałym adresem budowana z bloków; bez publikacji pokazuje treść wyjściową.
export default function CmsRoutePage({ slug }) {
  const page = usePublishedPage(slug);
  if (page === undefined && INSTANT.includes(slug) && PAGE_DEFAULTS[slug]) return <BlockRenderer blocks={PAGE_DEFAULTS[slug]} />;
  if (page === undefined) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return <BlockRenderer blocks={page?.bloki || PAGE_DEFAULTS[slug]} />;
}