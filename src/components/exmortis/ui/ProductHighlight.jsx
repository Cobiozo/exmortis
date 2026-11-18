import React from "react";
import { cn } from "@/lib/utils";

// ProductHighlight — znaczek wyróżnienia produktu na okładce (najwyżej jeden na kartę, lewy górny róg).
// kind: "nowosc" (złoty) · "promocja" (bordowy) · "rabat" (kość słoniowa). Własna treść: label.
// Użycie: <ProductHighlight kind="promocja" />  ·  <ProductHighlight kind="rabat" label="−20%" />
const KINDS = {
  nowosc: { label: "Nowość", cls: "bg-exm-gold text-exm-bg" },
  promocja: { label: "Promocja", cls: "bg-exm-bordo text-exm-ivory" },
  rabat: { label: "Rabat", cls: "bg-exm-ivory text-exm-bg" },
};

export default function ProductHighlight({ kind = "nowosc", label, className = "" }) {
  const k = KINDS[kind] || KINDS.nowosc;
  return (
    <span className={cn("inline-flex items-center rounded-[var(--exm-r-pill)] px-3 py-1 text-[11px] font-medium leading-none", k.cls, className)}>
      {label || k.label}
    </span>
  );
}