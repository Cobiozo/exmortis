import React from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// Pusty koszyk w panelu: zachęta do bezpłatnych materiałów i do programu „Wracam inny”.
export default function CartEmpty({ onNavigate }) {
  return (
    <EmptyState
      icon={<ShoppingBag />}
      title="Koszyk jest pusty"
      description="Zacznij od bezpłatnych materiałów w Skarbcu. Jeśli szukasz dłuższej pracy — zobacz program „Wracam inny”."
      action={
        <div className="flex flex-col items-center gap-1">
          <BrandButton to="/skarbiec" onClick={onNavigate}>Zacznij od bezpłatnych materiałów</BrandButton>
          <Link to="/skarbiec/wracam-inny" onClick={onNavigate} className="btn-link justify-center">
            Wracam inny
          </Link>
        </div>
      }
    />
  );
}