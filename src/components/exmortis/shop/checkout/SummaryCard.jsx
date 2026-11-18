import React from "react";
import { Lock } from "lucide-react";
import { Image } from "@/components/ui/image";
import PaperCard from "@/components/exmortis/ui/PaperCard";
import DiscountField from "@/components/exmortis/shop/DiscountField";
import OrderSummaryInfo from "@/components/exmortis/shop/OrderSummaryInfo";
import { GiftLine } from "@/components/exmortis/shop/GiftCard";
import { TicketLine } from "@/components/exmortis/events/TicketBuy";
import { zl } from "@/lib/productPrice";

// Podsumowanie zamówienia na papierowej karcie: pozycje z miniaturą, kod rabatowy, suma,
// informacje o dostarczeniu i dostępie oraz informacja o płatności. Ta sama treść na telefonie i komputerze.
export default function SummaryCard({ items, total, sum, sumPl, discount, onDiscount, email, withInfo = true }) {
  return (
    <PaperCard className="p-5 md:p-6">
      <p className="technical text-[10px] text-exm-bg/60">Podsumowanie zamówienia</p>

      <ul className="mt-4 divide-y divide-exm-bg/10 border-y border-exm-bg/10">
        {items.map((item) => (
          <li key={item.key || item.id} className="flex gap-3 py-3">
            <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-[6px] border border-exm-bg/10 bg-exm-bg/5">
              {item.image_url && (
                <Image src={item.image_url} alt="" fittingType="fill" className="absolute inset-0 h-full w-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[14px] font-medium leading-snug text-exm-bg">{item.name}</p>
              <p className="mt-1 text-[12px] text-exm-bg/70">{item.qty} × {zl(item.price)}</p>
              {item.gift && <GiftLine gift={item.gift} tone="paper" />}
              {item.kind === "bilet" && <TicketLine holders={item.holders} tone="paper" />}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <DiscountField items={items} applied={discount} onApply={onDiscount} email={email} />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-exm-bg/15 pt-4">
        <span className="text-[13px] text-exm-bg/70">Do zapłaty</span>
        <span className="font-exm-serif text-2xl text-exm-bg">{sumPl} zł</span>
      </div>

      {withInfo && (
        <div className="mt-4 border-t border-exm-bg/15 pt-4">
          <OrderSummaryInfo items={items} total={sum} />
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-exm-bg/70">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Płatność realizowana przez PayU. Potwierdzenie otrzymasz w wiadomości e-mail.</span>
      </p>
    </PaperCard>
  );
}