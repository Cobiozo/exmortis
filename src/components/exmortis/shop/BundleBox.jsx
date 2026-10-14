import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { TYPE_LABEL } from "@/components/account/accountUtils";
import { unitPrice, zl } from "@/lib/productPrice";

// Zawartość pakietu na stronie produktu: składniki, wartość osobno, oszczędność, „masz już”.
export default function BundleBox({ product }) {
  const b = product?.bundle;
  if (!b?.items?.length) return null;

  const price = unitPrice(product);
  const strike = Number(b.separately) > price;
  const owned = b.items.filter((c) => c.owned);

  return (
    <div className="border hairline bg-[#0D0D0E] p-6 mb-10">
      <p className="technical text-[10px] gold-text mb-4">
        W PAKIECIE · {b.items.length} {b.items.length < 5 ? "PRODUKTY" : "PRODUKTÓW"}
      </p>
      <ul className="space-y-3 mb-5">
        {b.items.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-4">
            <span className="flex items-start gap-3 min-w-0">
              <Check className="h-4 w-4 gold-text mt-1 flex-shrink-0" />
              <span className="min-w-0">
                {c.available ? (
                  <Link to={`/skarbiec/${c.slug}`} className="text-[#F5EFE1] hover:gold-text transition-colors [overflow-wrap:anywhere]">
                    {c.name}
                  </Link>
                ) : (
                  <span className="text-[#F5EFE1] [overflow-wrap:anywhere]">{c.name}</span>
                )}
                <span className="block technical text-[9px] text-foreground/40 mt-0.5">
                  {(TYPE_LABEL[c.product_type] || c.product_type || "").toUpperCase()}
                  {c.owned ? " · MASZ JUŻ" : ""}
                </span>
              </span>
            </span>
            <span className="font-mono text-sm text-foreground/60 whitespace-nowrap">{zl(c.price)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm border-t hairline pt-4">
        <span className="text-foreground/60">
          Osobno: <span className={strike ? "line-through" : ""}>{zl(b.separately)}</span>
        </span>
        <span className="text-foreground/60">
          Pakiet: <span className="gold-text font-mono">{zl(price)}</span>
        </span>
        {b.save > 0 && <span className="technical text-[10px] gold-text">OSZCZĘDZASZ {zl(b.save)}</span>}
      </div>
      {owned.length > 0 && (
        <p className="text-sm text-foreground/60 mt-3">Masz już: {owned.map((c) => c.name).join(", ")}.</p>
      )}
    </div>
  );
}