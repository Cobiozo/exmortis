import React from "react";
import { isDigital } from "@/components/account/accountUtils";

export const CONSENT_TEXT =
  "Żądam dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy i przyjmuję do wiadomości, że z chwilą rozpoczęcia ich dostarczania tracę prawo odstąpienia od umowy.";

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
    <div className="space-y-4">
      {digital.map((i) => (
        <p key={i.id} className="text-sm text-foreground/60">
          {i.name}: {i.access_months ? `Dostęp: ${i.access_months} miesięcy od zakupu — do ${until(i.access_months)}` : "Dostęp: bezterminowy"}
        </p>
      ))}
      <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed">
        <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{CONSENT_TEXT}</span>
      </label>
    </div>
  );
}