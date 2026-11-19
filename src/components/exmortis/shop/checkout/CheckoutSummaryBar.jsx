import React from "react";
import SummaryCard from "./SummaryCard";

// Telefon (19.11.2026): podsumowanie zawsze rozwinięte nad formularzem —
// produkt, pole kodu rabatowego i suma są widoczne od razu, bez rozwijania.
export default function CheckoutSummaryBar(props) {
  return (
    <section className="lg:hidden" aria-label="Podsumowanie zamówienia" id="podsumowanie-kasy">
      {/* Informacje o dostarczeniu i dostępie są w formularzu, nad oświadczeniami — bez powtarzania ich tutaj. */}
      <SummaryCard {...props} withInfo={false} />
    </section>
  );
}
