import React from "react";
import { Link } from "react-router-dom";

// Stopka zaufania Skarbca: gwarancja, kryzys, linki prawne.
export default function TrustFooter() {
  return (
    <section className="py-16 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[900px] text-center space-y-6">
        <p className="text-sm text-foreground/45 leading-relaxed max-w-2xl mx-auto">
          Gwarancja 14 dni na produkty cyfrowe — jeśli uznasz, że nic Ci nie dały, napisz, zwrócę
          pieniądze. Materiały exmortis nie zastępują terapii ani pomocy medycznej. Jeśli jesteś w
          kryzysie, zadzwoń pod bezpłatny numer{" "}
          <a href="tel:116123" className="gold-text hover:underline">
            116 123
          </a>{" "}
          lub{" "}
          <a href="tel:112" className="gold-text hover:underline">
            112
          </a>
          .
        </p>
        <div className="flex items-center justify-center gap-4 technical text-[9px] text-foreground/30 flex-wrap">
          <a href="#" className="hover:text-foreground/60 transition-colors">
            REGULAMIN
          </a>
          <span>·</span>
          <a href="#" className="hover:text-foreground/60 transition-colors">
            POLITYKA ZWROTÓW
          </a>
          <span>·</span>
          <Link to="/produkt/karta-podarunkowa" className="hover:text-foreground/60 transition-colors">
            KARTY PODARUNKOWE
          </Link>
        </div>
      </div>
    </section>
  );
}