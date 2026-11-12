import React from "react";
import { Link } from "react-router-dom";
import { isDigital } from "@/components/account/accountUtils";

// Zgoda z art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta — musi być osobna i niezaznaczona domyślnie.
// Ta sama treść jest w payuCreateOrder (DIGITAL_CONSENT) i trafia do rejestru zgód.
export const CONSENT_TEXT =
  "Chcę otrzymać dostęp od razu po zapłacie, przed upływem 14 dni na odstąpienie od umowy. Wiem, że z chwilą rozpoczęcia dostarczania tracę prawo odstąpienia.";

const until = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
};

// Zgoda na treści cyfrowe + informacja o czasie dostępu nad przyciskiem płatności.
export default function DigitalConsent({ items, checked, onChange }) {
  const digital = items.filter(isDigital);
  if (!digital.length) return null;
  return (
    <div className="space-y-3">
      {digital.map((i) => (
        <p key={i.id} className="text-xs text-foreground/55">
          {i.name}: {i.access_months ? `Dostęp: ${i.access_months} miesięcy od zakupu — do ${until(i.access_months)}` : "Dostęp: bezterminowy"}
        </p>
      ))}
      <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed cursor-pointer">
        <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {CONSENT_TEXT}{" "}
          <Link to="/regulamin#p14" target="_blank" rel="noopener" className="underline whitespace-nowrap">Szczegóły (§14)</Link>
        </span>
      </label>
    </div>
  );
}