import React from "react";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

// Mini galeria pod zdjęciem produktu: kliknięcie miniatury pokazuje ją jako zdjęcie główne.
export default function ProductThumbs({ images, active, onPick, name }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Galeria zdjęć">
      {images.map((src, i) => (
        <button
          key={src + i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`Zdjęcie ${i + 1} z ${images.length}: ${name}`}
          aria-pressed={i === active}
          className={cn(
            "relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border bg-exm-surface-2 transition-colors md:h-20 md:w-20",
            i === active ? "border-exm-gold" : "border-exm-line opacity-70 hover:opacity-100"
          )}
        >
          <Image src={src} alt="" className="absolute inset-0 h-full w-full" />
        </button>
      ))}
    </div>
  );
}