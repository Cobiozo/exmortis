import React, { useEffect } from "react";
import CmsRoutePage from "@/components/cms/CmsRoutePage";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";

export default function Powrot() {
  useEffect(() => { track(FUNNEL.viewPowrot); }, []);
  return <CmsRoutePage slug="powrot" />;
}