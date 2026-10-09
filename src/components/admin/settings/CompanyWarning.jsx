import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import useSiteSettings from "@/lib/useSiteSettings";
import { missingFirma } from "@/lib/firma";

// Czerwone ostrzeżenie w panelu, dopóki dane firmy są niepełne (publicznie punkty zostają, z „…”).
export default function CompanyWarning() {
  const s = useSiteSettings();
  if (!s) return null;
  const missing = missingFirma(s.firma);
  if (!missing.length) return null;
  return (
    <Link to="/admin/ustawienia" className="flex gap-3 items-start bg-[#5C1A1B] border border-[#BC1E22] text-[#F5EFE1] px-5 py-4 mb-8 hover:border-[#C9A24A]">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <span><strong className="block">Uzupełnij Dane firmy — widoczne publicznie jako „…”</strong>
        <span className="text-sm text-[#F5EFE1]/75">Brakuje: {missing.join(", ")}. Na stronach prawnych i w klauzulach w tych miejscach widać „…”.</span></span>
    </Link>
  );
}