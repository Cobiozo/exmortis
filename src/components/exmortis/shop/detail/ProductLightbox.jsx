import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Image } from "@/components/ui/image";

// Powiększone zdjęcie produktu na pełnym ekranie: strzałki (także klawisze ←/→), Esc lub klik w tło zamyka.
export default function ProductLightbox({ images, index, onIndex, onClose, name }) {
  const n = images.length;
  const go = (d) => onIndex((index + d + n) % n);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (n > 1 && e.key === "ArrowLeft") go(-1);
      if (n > 1 && e.key === "ArrowRight") go(1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  });

  const btn = "absolute z-10 flex h-12 w-12 items-center justify-center rounded-full border border-exm-line-strong bg-exm-surface text-exm-ivory hover:text-exm-gold";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Zdjęcie: ${name}`} className="fixed inset-0 z-[200] flex items-center justify-center bg-exm-bg p-4" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Zamknij" className={`${btn} right-4 top-[calc(1rem+env(safe-area-inset-top))]`}>
        <X className="h-5 w-5" />
      </button>
      {n > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Poprzednie zdjęcie" className={`${btn} left-3 top-1/2 -translate-y-1/2`}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Następne zdjęcie" className={`${btn} right-3 top-1/2 -translate-y-1/2`}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div className="relative h-[85svh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <Image key={images[index]} src={images[index]} alt={name} fittingType="fit" className="absolute inset-0 h-full w-full" />
      </div>
      {n > 1 && <p className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] text-[13px] text-exm-muted">{index + 1} / {n}</p>}
    </div>,
    document.body
  );
}