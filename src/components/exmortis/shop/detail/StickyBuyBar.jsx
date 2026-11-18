import React, { useEffect, useRef, useState } from "react";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ShopPrice from "@/components/exmortis/shop/vault/ShopPrice";
import { useBottomBar } from "@/lib/bottomBar";

// Telefon: pasek z ceną i przyciskiem przyklejony do dołu. Pojawia się dopiero, gdy blok zakupu
// zostanie przewinięty w górę (jest nad ekranem), znika przy końcu strony (nie zasłania treści),
// respektuje safe-area i podnosi przycisk „Nagła pomoc” (zmienna --exm-bottom-bar).
function Bar({ product, label, onAction }) {
  const ref = useRef(null);
  // Hook w komponencie, który istnieje tylko przy widocznym pasku — ref jest już podpięty przy montowaniu.
  useBottomBar(ref);
  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-exm-line bg-exm-bg/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <ShopPrice p={product} />
        </div>
        <BrandButton onClick={onAction} className="shrink-0">{label}</BrandButton>
      </div>
    </div>
  );
}

export default function StickyBuyBar({ product, label, onAction, targetId = "kup-teraz", endId = "produkt-koniec" }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const buy = document.getElementById(targetId);
    const end = document.getElementById(endId);
    if (!buy || !end) return undefined;
    let buyPassed = false; // blok zakupu przewinięty w górę, poza ekran
    let endSeen = false;
    const sync = () => setShow(buyPassed && !endSeen);
    const ioBuy = new IntersectionObserver(([e]) => {
      buyPassed = !e.isIntersecting && e.boundingClientRect.top < 0;
      sync();
    }, { threshold: 0 });
    const ioEnd = new IntersectionObserver(([e]) => { endSeen = e.isIntersecting; sync(); }, { threshold: 0 });
    ioBuy.observe(buy);
    ioEnd.observe(end);
    return () => { ioBuy.disconnect(); ioEnd.disconnect(); };
  }, [targetId, endId]);

  return show ? <Bar product={product} label={label} onAction={onAction} /> : null;
}
