import React from "react";
import LegalPage from "@/components/legal/LegalPage";
import { UMOWA_POWROT } from "@/content/legal/umowaPowrot";

export default function UmowaPowrot() {
  return <LegalPage doc={UMOWA_POWROT} docKey="umowa_powrot" />;
}
