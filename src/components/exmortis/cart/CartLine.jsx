import React from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import ShopMedia from "@/components/exmortis/shop/vault/ShopMedia";
import { GiftLine } from "@/components/exmortis/shop/GiftCard";
import { TicketLine } from "@/components/exmortis/events/TicketBuy";
import { zl } from "@/lib/productPrice";
import { cn } from "@/lib/utils";

// Jedna pozycja w panelu koszyka: okładka w stałych proporcjach, nazwa, format, cena, ilość, usuń.
// Ilość zmienia się tylko tam, gdzie kasa na serwerze przyjmuje więcej niż 1 sztukę
// (plik osobisty PDF i bilet mają stałą liczbę — tak jak dotąd).
const FORMAT = {
  pdf: "E-book (PDF)",
  audio: "Nagranie audio",
  kurs: "Kurs",
  wideo: "Wideo",
  zestaw: "E-book z nagraniami",
  usluga: "Usługa 1:1",
  karta: "Karta podarunkowa",
  pakiet: "Pakiet",
  bilet: "Bilet",
};

const hrefFor = (item) => (item.kind === "bilet" ? `/spotkania/${item.slug}` : `/skarbiec/${item.slug}`);

export default function CartLine({ item, onNavigate, onRemove, onQty }) {
  const format = FORMAT[item.kind === "bilet" ? "bilet" : item.product_type] || "";
  const fixedQty = item.kind === "bilet" || item.product_type === "pdf";
  const href = hrefFor(item);

  return (
    <li className="flex gap-4 py-5">
      <Link
        to={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden="true"
        className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface-2"
      >
        <ShopMedia product={{ cover_image: item.image_url, name: item.name }} />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={href}
          onClick={onNavigate}
          className="block break-words text-[15px] font-medium leading-snug text-exm-ivory hover:text-exm-gold"
        >
          {item.name}
        </Link>
        {format && <p className="technical mt-1.5 text-[10px] text-exm-muted">{format}</p>}

        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[15px] text-exm-gold">
          {zl(item.price)}
          {item.qty > 1 && <span className="text-[12px] text-exm-muted">× {item.qty}</span>}
        </p>

        {item.gift && <GiftLine gift={item.gift} />}
        {item.kind === "bilet" && <TicketLine holders={item.holders} />}

        <div className="mt-3 flex items-center justify-between gap-3">
          {fixedQty ? (
            <span className="text-[12px] text-exm-muted">
              {item.kind === "bilet" ? `Liczba osób: ${item.qty}` : "1 sztuka · plik osobisty"}
            </span>
          ) : (
            <div className="inline-flex items-center rounded-[var(--exm-r-field)] border border-exm-line">
              <button
                type="button"
                onClick={() => onQty(item.qty - 1)}
                aria-label={`Mniej: ${item.name}`}
                className="grid h-11 w-11 place-items-center text-exm-muted hover:text-exm-gold"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-8 text-center text-[13px] tabular-nums" aria-live="polite">{item.qty}</span>
              <button
                type="button"
                onClick={() => onQty(item.qty + 1)}
                aria-label={`Więcej: ${item.name}`}
                className="grid h-11 w-11 place-items-center text-exm-muted hover:text-exm-gold"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Usuń z koszyka: ${item.name}`}
            className={cn("grid h-11 w-11 place-items-center rounded-[var(--exm-r-field)] text-exm-muted", "hover:bg-exm-surface-2 hover:text-exm-error")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}