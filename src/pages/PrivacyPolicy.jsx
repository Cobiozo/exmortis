import React from "react";
import LegalPage from "@/components/legal/LegalPage";
import { PRYWATNOSC } from "@/content/legal/prywatnosc";

export default function PrivacyPolicy() {
  return <LegalPage doc={PRYWATNOSC} />;
}