import React from "react";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

// Okładka w kadrze o ustalonych proporcjach. Spód: ta sama grafika rozmyta i przyciemniona,
// wypełniająca kadr. Wierzch: cała okładka (object-contain), wyśrodkowana, z marginesem —
// nic nie jest rozciągnięte, nic nie jest ucięte, także gdy plik jest 1:1 w kadrze 16:9.
export default function CoverStage({ src, alt = "", pad = "p-3" }) {
  if (!src) return null;
  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fittingType="fill"
        className="absolute inset-0 w-full h-full blur-2xl opacity-35 scale-110"
      />
      <div className={cn("absolute inset-0", pad)}>
        <Image
          src={src}
          alt={alt}
          fittingType="fit"
          className="w-full h-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
        />
      </div>
    </>
  );
}