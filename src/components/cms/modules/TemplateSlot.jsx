import React from "react";
import { useParams } from "react-router-dom";
import EventDetail from "@/pages/EventDetail";
import ProductDetail from "@/pages/ProductDetail";

// Miejsce na treść z modułu w szablonie. W podglądzie edytora (bez adresu) pokazuje zaślepkę.
function slot(Component, text) {
  return function Slot() {
    const { slug } = useParams();
    if (slug) return <Component />;
    return (
      <div className="px-5 md:px-10 py-24 bg-[#0A0A0B]">
        <div className="mx-auto max-w-[1200px] border border-dashed border-[#C9A24A]/50 p-10 text-center">
          <p className="technical text-[10px] gold-text mb-3">MIEJSCE NA TREŚĆ</p>
          <p className="text-foreground/60">{text}</p>
        </div>
      </div>
    );
  };
}

export const EventSlot = slot(EventDetail, "Tu pojawi się strona wybranego spotkania: okładka, opis, termin i zapis. Edytujesz je w zakładce Spotkania.");
export const ProductSlot = slot(ProductDetail, "Tu pojawi się karta wybranego produktu: zdjęcie, opis, cena i zakup. Edytujesz je w zakładce Skarbiec.");