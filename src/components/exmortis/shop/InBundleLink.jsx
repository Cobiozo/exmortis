import React from "react";
import { Link } from "react-router-dom";
import { zl } from "@/lib/productPrice";

// Składnik pakietu: informacja, że taniej kupić go razem z innymi.
export default function InBundleLink({ product }) {
  const list = product?.in_packages;
  if (!list?.length) return null;
  return (
    <div className="mb-8 space-y-1">
      {list.map((b) => (
        <p key={b.slug} className="text-sm text-foreground/60">
          Taniej w pakiecie:{" "}
          <Link to={`/skarbiec/${b.slug}`} className="gold-text hover:underline">
            {b.name}
          </Link>
          {Number(b.price) > 0 && <span className="text-foreground/45"> · {zl(b.price)}</span>}
        </p>
      ))}
    </div>
  );
}