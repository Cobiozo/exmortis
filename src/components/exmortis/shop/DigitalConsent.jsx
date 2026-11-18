import React from "react";
import { Link } from "react-router-dom";
import { isDigital } from "@/components/account/accountUtils";

// Zgoda z art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta — musi być osobna i niezaznaczona domyślnie.
// Ta sama treść jest w payuCreateOrder (DIGITAL_CONSENT) i trafia do rejestru zgód.
export const CONSENT_TEXT =
  "Chcę otrzymać dostęp od razu po zapłacie, przed upływem 14 dni na odstąpienie od umowy. Wiem, że z chwilą rozpoczęcia dostarczania tracę prawo odstąpienia.";


// Zgoda na treści cyfrowe + informacja o czasie dostępu nad przyciskiem płatności.
export default function DigitalConsent({ items, checked, onChange }) {
  const digital = items.filter(isDigital);
  if (!digital.length) return null;
  return (
    <div>
      {/* Czas dostępu każdego materiału jest w informacjach nad zgodami (OrderSummaryInfo). */}
      <label className="flex cursor-pointer gap-3 text-[14px] leading-relaxed text-exm-text">
        <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {CONSENT_TEXT}{" "}
          <Link to="/regulamin#p14" target="_blank" rel="noopener" className="underline whitespace-nowrap">Szczegóły (§14)</Link>
        </span>
      </label>
    </div>
  );
}