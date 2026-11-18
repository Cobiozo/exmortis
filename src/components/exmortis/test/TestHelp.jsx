import React from "react";
import { cn } from "@/lib/utils";

// Informacja o granicach testu i numery pomocowe (treść bez zmian, przeniesiona z Test.jsx).
export default function TestHelp({ className = "" }) {
  const a = "text-exm-gold underline decoration-exm-gold-line underline-offset-4 hover:text-exm-gold-hover whitespace-nowrap";
  return (
    <div className={cn("text-[13px] leading-relaxed text-exm-muted", className)}>
      <p>
        Trzy śmierci są autorskimi metaforami doświadczeń życiowych, nie kategoriami medycznymi. Test nie jest narzędziem
        diagnostycznym ani formą terapii. Jeśli potrzebujesz pomocy psychologicznej lub medycznej, zwróć się do odpowiedniego specjalisty.
      </p>
      <p className="mt-2">
        W kryzysie możesz skorzystać z bezpłatnych numerów <a href="tel:116123" className={a}>116 123</a> i{" "}
        <a href="tel:800702222" className={a}>800 70 2222</a>; w bezpośrednim zagrożeniu życia zadzwoń pod <a href="tel:112" className={a}>112</a>.
      </p>
    </div>
  );
}