import React from "react";
import LegalPage from "@/components/legal/LegalPage";
import { REGULAMIN } from "@/content/legal/regulamin";

export default function Regulamin() {
  return <LegalPage doc={REGULAMIN} docKey="regulamin" />;
}