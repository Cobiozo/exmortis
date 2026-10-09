import React from "react";
import { Link } from "react-router-dom";
import { isDigital } from "@/components/account/accountUtils";
import { useFirma } from "@/lib/useSiteSettings";

const until = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toLocaleDateString("pl-PL"); };

// Informacje wymagane przed złożeniem zamówienia na odległość.
export default function OrderSummaryInfo({ items, total }) {
  const digital = items.some(isDigital);
  return (
    <div className="border hairline p-5 space-y-2 text-sm text-foreground/65 leading-relaxed">
      {items.map((i) => (
        <p key={i.id}><span className="text-foreground/90">{i.name}</span>{i.subtitle ? ` — ${i.subtitle}` : ""}. {isDigital(i) ? (i.access_months ? `Dostęp: ${i.access_months} miesięcy od zakupu — do ${until(i.access_months)}.` : "Dostęp: bez ograniczenia czasowego.") : ""}</p>
      ))}
      <p>Cena łączna brutto: <span className="gold-text">{total} zł</span></p>
      <p>Dostarczenie: w Twoim koncie zaraz po zaksięgowaniu płatności.</p>
      <p>Wymagania techniczne: <Link to="/regulamin#p3" className="underline">§3 Regulaminu</Link>.</p>
      <p>{digital ? "Treści cyfrowe: po rozpoczęciu dostarczania tracisz prawo odstąpienia od umowy (za Twoją zgodą poniżej)." : "Masz 14 dni na odstąpienie od umowy bez podania przyczyny."}</p>
      <p className="text-xs text-foreground/45">{seller && `Sprzedawca: ${seller} · `}<Link to="/regulamin" className="underline">Regulamin</Link></p>
    </div>
  );
}