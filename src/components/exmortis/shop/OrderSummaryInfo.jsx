import React from "react";
import { Link } from "react-router-dom";
import { isDigital } from "@/components/account/accountUtils";
import { useFirma } from "@/lib/useSiteSettings";
import { cn } from "@/lib/utils";

const until = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toLocaleDateString("pl-PL"); };

// Informacje wymagane przed złożeniem zamówienia na odległość — treść bez zmian.
// tone: "paper" (na jasnej karcie podsumowania) albo "dark" (na ciemnym tle formularza).
const TONES = {
  paper: { box: "text-exm-bg/75", strong: "text-exm-bg font-medium", accent: "text-exm-bg font-medium", muted: "text-exm-bg/60" },
  dark: { box: "text-exm-muted", strong: "text-exm-text", accent: "text-exm-gold", muted: "text-exm-muted" },
};

export default function OrderSummaryInfo({ items, total, tone = "paper", className = "" }) {
  const f = useFirma();
  const seller = [f.nazwa, f.adres || f.korespondencja, f.nip && `NIP ${f.nip}`].filter(Boolean).join(", ");
  const digital = items.some(isDigital);
  const t = TONES[tone] || TONES.paper;
  return (
    <div className={cn("space-y-2 text-[13px] leading-relaxed", t.box, className)}>
      {items.map((i) => (
        <p key={i.id}><span className={t.strong}>{i.name}</span>{i.subtitle ? ` — ${i.subtitle}` : ""}. {isDigital(i) ? (i.access_months ? `Dostęp: ${i.access_months} miesięcy od zakupu — do ${until(i.access_months)}.` : "Dostęp: bez ograniczenia czasowego.") : ""}</p>
      ))}
      <p>Cena łączna brutto: <span className={t.accent}>{total} zł</span></p>
      {digital ? (
        <p>Dostarczenie: zaraz po zaksięgowaniu płatności — link do pobrania na Twój e-mail (ważny 7 dni, nowy wyślesz sobie w każdej chwili){items.some((i) => i.product_type === "kurs" || i.product_type === "wideo") ? "; kursy i wideo na bezpłatnym koncie exmortis, które aktywujesz jednym kliknięciem" : ""}. Z kontem zakup jest też w Moich produktach.</p>
      ) : (
        <p>Dostarczenie: szczegóły i dalsze kroki na Twój e-mail zaraz po zaksięgowaniu płatności.</p>
      )}
      <p>Wymagania techniczne: <Link to="/regulamin#p3" className="underline">§3 Regulaminu</Link>.</p>
      <p>{digital ? "Treści cyfrowe: po rozpoczęciu dostarczania tracisz prawo odstąpienia od umowy (za Twoją zgodą poniżej)." : "Masz 14 dni na odstąpienie od umowy bez podania przyczyny."}</p>
      <p className={cn("text-[12px]", t.muted)}>{seller && `Sprzedawca: ${seller} · `}<Link to="/regulamin" className="underline">Regulamin</Link></p>
    </div>
  );
}