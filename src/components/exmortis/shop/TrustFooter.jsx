import React from "react";
import { Link } from "react-router-dom";

// Stopka zaufania Skarbca: gwarancja, kryzys, linki prawne.
export default function TrustFooter() {
  return (
    <section className="py-20 md:py-24 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[900px] text-center space-y-6">
        <p className="text-sm text-foreground/55 leading-relaxed max-w-2xl mx-auto">
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
        <div className="flex items-center justify-center gap-x-3 technical text-[10px] text-foreground/55 flex-wrap">
          <Link to="/regulamin" className="inline-block py-2.5 hover:text-foreground/75 transition-colors">
            REGULAMIN
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/odstapienie" className="inline-block py-2.5 hover:text-foreground/75 transition-colors">
            ZWROTY I ODSTĄPIENIE
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/skarbiec/karta-podarunkowa" className="inline-block py-2.5 hover:text-foreground/75 transition-colors">
            KARTY PODARUNKOWE
          </Link>
        </div>
      </div>
    </section>
  );
}