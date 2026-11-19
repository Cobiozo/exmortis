import React, { useEffect } from "react";
import CmsRoutePage from "@/components/cms/CmsRoutePage";
import PowrotStickyBar from "@/components/exmortis/powrot/PowrotStickyBar";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";

export default function Powrot() {
  useEffect(() => { track(FUNNEL.viewPowrot); }, []);
  return (
    <>
      <CmsRoutePage slug="powrot" />
      <PowrotStickyBar />
    </>
  );
}
