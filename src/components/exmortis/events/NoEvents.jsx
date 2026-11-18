import React from "react";
import { CalendarClock } from "lucide-react";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import BrandButton from "@/components/exmortis/ui/BrandButton";

// Pusta lista spotkań: informacja bez zmyślonej daty i wejście do Listów powrotu.
export default function NoEvents() {
  return (
    <EmptyState
      icon={<CalendarClock />}
      title="Kolejne spotkanie jest w przygotowaniu"
      description="Termin ogłaszam najpierw w Listach powrotu. Zostaw adres — napiszę, gdy będzie można się zapisać."
      action={<BrandButton href="/#listy-powrotu" variant="secondary">Listy powrotu</BrandButton>}
    />
  );
}