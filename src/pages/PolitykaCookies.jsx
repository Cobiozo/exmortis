import React from "react";
import LegalPage from "@/components/legal/LegalPage";
import { COOKIES } from "@/content/legal/cookies";

export default function PolitykaCookies() {
  return <LegalPage doc={COOKIES} docKey="cookies" />;
}