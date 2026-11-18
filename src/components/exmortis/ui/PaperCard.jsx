import React from "react";
import { cn } from "@/lib/utils";

// PaperCard — „karta papieru”: jasne tło (#F5EFE1), ciemny tekst. Do okładki książki i podsumowania zamówienia.
// Użycie: <PaperCard><p className="exm-eyebrow">Zamówienie</p>…</PaperCard>
export default function PaperCard({ className = "", children, ...rest }) {
  return (
    <div className={cn("rounded-[var(--exm-r-card)] bg-exm-ivory p-6 text-exm-bg md:p-8", className)} {...rest}>
      {children}
    </div>
  );
}