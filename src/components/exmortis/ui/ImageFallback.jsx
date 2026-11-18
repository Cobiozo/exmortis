import React from "react";
import { cn } from "@/lib/utils";

// ImageFallback — brak zdjęcia: ciemna tekstura z sygnetem EXMORTIS (bez zdjęć ludzi).
// Użycie: <ImageFallback className="aspect-[3/4]" label="Okładka ebooka" />
export default function ImageFallback({ className = "", label = "Grafika exmortis" }) {
  return (
    <div role="img" aria-label={label} className={cn("relative flex items-center justify-center overflow-hidden bg-exm-surface-2", className)}>
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 28% 22%, #C9A24A 0, transparent 46%), radial-gradient(circle at 76% 82%, #5C1A1B 0, transparent 42%)",
        }}
      />
      <img src="/exmortis-logo-144.webp" alt="" aria-hidden="true" className="relative h-12 w-12 opacity-60 md:h-14 md:w-14" />
    </div>
  );
}