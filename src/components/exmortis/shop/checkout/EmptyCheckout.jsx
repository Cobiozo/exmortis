import React from "react";
import { ShoppingBag } from "lucide-react";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// Kasa bez zawartości koszyka — spokojny stan na środku strony.
export default function EmptyCheckout() {
  return (
    <div className="bg-exm-bg pt-20">
      <div className="mx-auto w-full max-w-[var(--exm-container-narrow)] px-[var(--exm-pad)] py-16">
        <EmptyState
          icon={<ShoppingBag />}
          title="Koszyk jest pusty"
          description="Dodaj materiał ze Skarbca — wtedy wrócisz tutaj, żeby dokończyć zamówienie."
          action={<BrandButton to="/skarbiec">Do Skarbca</BrandButton>}
        />
      </div>
    </div>
  );
}