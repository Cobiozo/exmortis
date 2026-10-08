import React from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { PAGE_DEFAULTS } from "@/components/cms/defaults/otherDefaults";

// Strona pod stałym adresem budowana z bloków; bez publikacji pokazuje treść wyjściową.
export default function CmsRoutePage({ slug }) {
  const page = usePublishedPage(slug);
  if (page === undefined) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return <div className="bg-[#0A0A0B] pt-20"><BlockRenderer blocks={page?.bloki || PAGE_DEFAULTS[slug]} /></div>;
}