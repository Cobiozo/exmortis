import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus } from "lucide-react";
import FreeOrderForm from "@/components/exmortis/shop/FreeOrderForm";
import { GiftCardBuy } from "@/components/exmortis/shop/GiftCard";
import GuaranteeInfo from "@/components/exmortis/shop/GuaranteeInfo";
import { accessLabel, isDigital } from "@/components/account/accountUtils";
import { priceOnRequest } from "@/lib/productPrice";

// Przycisk główny karty produktu — zgodny z następnym ekranem. Kolejność i zachowanie bez zmian:
// zapowiedź → lista oczekujących; brak miejsc → lista; własny adres (bezpłatne / po rozmowie) → link;
// usługa ze zgłoszeniem → ścieżka zgłoszenia; bezpłatne → formularz; karta → kwoty; po rozmowie → kontakt;
// płatne → ilość, kasa i koszyk.
export default function ProductActions({ product, qty, setQty, onBuy, onAdd, added, onWaitlist }) {
  const soon = product.status === "wkrótce";
  const linkUrl = (product.checkout_url || "").trim();
  const onRequest = !soon && priceOnRequest(product);
  const soldOut = !!product.seats && product.seats.left <= 0;

  if (soon) {
    return (
      <div className="space-y-3">
        <button onClick={() => onWaitlist && onWaitlist()} className="btn-relic w-full">
          {product.product_type === "usluga" ? "Powiadom mnie o dostępności" : "Powiadom mnie o premierze"} <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-sm text-exm-muted">
          Ten materiał jeszcze powstaje. Napiszę, kiedy będzie gotowy.
        </p>
      </div>
    );
  }

  if (soldOut) {
    return (
      <div className="space-y-3">
        <button disabled className="btn-relic w-full opacity-40 cursor-not-allowed">Brak miejsc</button>
        <button onClick={() => onWaitlist && onWaitlist()} className="btn-ghost w-full">
          Daj znać, gdy zwolni się miejsce <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-sm text-exm-muted">
          Limit miejsc został wykorzystany. Zostaw kontakt — napiszę, gdy zwolni się miejsce.
        </p>
      </div>
    );
  }

  if (linkUrl && (product.is_free || onRequest)) {
    const label = product.button_label || (onRequest ? "Umów rozmowę" : "Zobacz");
    return linkUrl.startsWith("/") ? (
      <Link to={linkUrl} className="btn-relic w-full">{label} <ArrowRight className="h-4 w-4" /></Link>
    ) : (
      <a href={linkUrl} target="_blank" rel="noreferrer" className="btn-relic w-full">{label} <ArrowRight className="h-4 w-4" /></a>
    );
  }

  // Usługa z własną ścieżką (np. Rozmowa na progu: zgłoszenie z ankietą → płatność → termin).
  if (linkUrl.startsWith("/") && product.product_type === "usluga" && !product.is_free) {
    return (
      <div className="space-y-4">
        <Link to={linkUrl} className="btn-relic w-full">{product.button_label || "Umów rozmowę"} <ArrowRight className="h-4 w-4" /></Link>
        <p className="text-sm leading-relaxed text-exm-muted">
          Najpierw krótkie zgłoszenie z kilkoma pytaniami przygotowującymi do spotkania, potem płatność, a po niej wybór terminu w kalendarzu.
          Termin możesz bezpłatnie przełożyć najpóźniej 24 godziny przed spotkaniem.
        </p>
        {product.slug === "rozmowa-na-progu" && (
          <p className="text-[13px] leading-relaxed text-exm-muted">Osobna usługa, niezależna od programu POWRÓT.</p>
        )}
      </div>
    );
  }

  if (product.is_free) return <FreeOrderForm product={product} />;

  if (product.product_type === "karta") return <GiftCardBuy product={product} />;

  if (onRequest) {
    return (
      <Link to="/kontakt" className="btn-relic w-full">Napisz do mnie <ArrowRight className="h-4 w-4" /></Link>
    );
  }

  return (
    <div className="space-y-4">
      {product.product_type === "pdf" && (
        <p className="text-[13px] leading-relaxed text-exm-muted">
          Plik jest osobisty — oznaczony Twoim adresem e-mail i numerem zamówienia. Chcesz go komuś podarować?{" "}
          <Link to="/skarbiec/karta-podarunkowa" className="text-exm-gold hover:underline">Karta podarunkowa</Link>.
        </p>
      )}
      <div className="flex items-center gap-3">
        {/* Osobisty plik PDF (znak wodny z adresem kupującego) — bez wyboru ilości. */}
        {product.product_type !== "pdf" && product.product_type !== "usluga" && (
          <div className="flex items-center rounded-[var(--exm-r-field)] border border-exm-line">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Mniej" className="p-3 text-exm-muted hover:text-exm-gold">
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-4 font-exm-sans tabular-nums" aria-live="polite">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Więcej" className="p-3 text-exm-muted hover:text-exm-gold">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        <button onClick={onBuy} className="btn-relic flex-1">
          Przejdź do kasy <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <button onClick={onAdd} className="btn-ghost w-full">
        {added ? "Dodano do koszyka ✓" : "Dodaj do koszyka"}
      </button>
      {product.product_type === "usluga" && (
        <p className="text-sm leading-relaxed text-exm-muted">
          Po płatności wybierasz termin w kalendarzu rezerwacji albo proponuję go w ciągu 3 dni roboczych.
          Termin możesz bezpłatnie przełożyć najpóźniej 24 godziny przed spotkaniem.
        </p>
      )}
      {isDigital(product) && <p className="text-sm text-exm-muted">{accessLabel(product)}</p>}
      {isDigital(product) && <GuaranteeInfo />}
    </div>
  );
}