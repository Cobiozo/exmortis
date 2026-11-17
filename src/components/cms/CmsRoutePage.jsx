import React from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { PAGE_DEFAULTS } from "@/components/cms/defaults/otherDefaults";
import { withGlosWhatsapp } from "@/components/cms/glosWhatsapp";

// Strony, które od razu (bez czekania na serwer) pokazują treść wbudowaną — strona spotkania 1 listopada
// jest zawsze wbudowana (bez publikacji z edytora), więc nic się nie podmienia, a pierwsza treść pojawia się szybciej.
const INSTANT = ["1-listopada"];
// Strony w wyglądzie „jak w Moim koncie” (17.11.2026, decyzja właściciela): nagłówki EB Garamond, zaokrąglone karty
// i przyciski. Sam wygląd — style w index.css pod klasą .exm-soft-page; treść i funkcje bez zmian.
const SOFT = ["o-mnie", "powrot", "spotkania", "glos", "kontakt"];

// Strona pod stałym adresem budowana z bloków; bez publikacji pokazuje treść wyjściową.
export default function CmsRoutePage({ slug }) {
  const page = usePublishedPage(slug);
  if (page === undefined && INSTANT.includes(slug) && PAGE_DEFAULTS[slug]) return <BlockRenderer blocks={PAGE_DEFAULTS[slug]} />;
  if (page === undefined) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  // Kanał WhatsApp na GŁOSIE wchodzi kodem — rekord CMS strony zostaje bez zmian.
  const blocks = page?.bloki || PAGE_DEFAULTS[slug];
  const body = <BlockRenderer blocks={slug === "glos" ? withGlosWhatsapp(blocks) : blocks} />;
  return SOFT.includes(slug) ? <div className="exm-soft-page">{body}</div> : body;
}