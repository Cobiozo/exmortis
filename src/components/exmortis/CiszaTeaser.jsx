import React from "react";
import { Link } from "react-router-dom";

// Wejście do Minutnika ciszy — niewielka sekcja z dużą ilością powietrza.
export default function CiszaTeaser() {
  const btn =
    "inline-flex items-center justify-center px-8 py-3.5 technical text-xs border border-[#C9A24A]/60 text-[#C9A24A] hover:bg-[#C9A24A]/10 hover:border-[#C9A24A] transition-all duration-300";
  return (
    <section className="py-32 md:py-48 px-5 md:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1]">Masz trzy minuty?</h2>
        <p className="mt-6 text-foreground/55 leading-relaxed">
          Cisza jest luksusem, którego sobie odmawiamy. Możesz zacząć od razu, tutaj.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link to="/cisza?min=3&src=home" className={btn}>
            3 minuty
          </Link>
          <Link to="/cisza?min=5&src=home" className={btn}>
            5 minut
          </Link>
        </div>
      </div>
    </section>
  );
}