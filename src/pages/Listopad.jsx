import React from "react";
import CmsRoutePage from "@/components/cms/CmsRoutePage";
import { usePageMeta } from "@/lib/usePageMeta";
import { LISTOPAD_OG } from "@/components/cms/defaults/listopadDefault";

// /1-listopada — strona z edytora; ukryta dla wyszukiwarek do 16.10.
export default function Listopad() {
  usePageMeta({ canonical: "/1-listopada", ogImage: LISTOPAD_OG, noindex: false });
  return <CmsRoutePage slug="1-listopada" />;
}