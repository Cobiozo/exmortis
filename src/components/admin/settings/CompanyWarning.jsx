import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import useSiteSettings from "@/lib/useSiteSettings";
import { missingFirma } from "@/lib/firma";

// Czerwone ostrzeżenie na pulpicie, dopóki dane firmy są niepełne.
export default function CompanyWarning() {
  const s = useSiteSettings();
  if (!s) return null;
  const missing = missingFirma(s.firma);
  if (!missing.length) return null;
  return (
    <Link to="/admin/ustawienia" className="flex gap-3 items-start bg-[#5C1A1B] border border-[#BC1E22] text-[#F5EFE1] px-5 py-4 mb-8 hover:border-[#C9A24A]">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <span><strong className="block">Uzupełnij dane firmy — wymagane przed sprzedażą i przed 16.10</strong>
        <span className="text-sm text-[#F5EFE1]/75">Brakuje: {missing.join(", ")}. Do tego czasu te pola są ukryte na stronie.</span></span>
    </Link>
  );
}