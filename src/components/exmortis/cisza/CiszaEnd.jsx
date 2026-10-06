import React from "react";
import { Link } from "react-router-dom";

// Ekran końcowy.
export default function CiszaEnd({ text, onAgain, reduced }) {
  return (
    <section className={`min-h-screen flex flex-col items-center justify-center px-8 text-center ${reduced ? "" : "fade-up"}`}>
      <p className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] max-w-2xl leading-tight">{text}</p>
      <div className="mt-14 flex items-center gap-8 text-sm">
        <button onClick={onAgain} className="text-foreground/45 hover:text-[#C9A24A] transition-colors">Jeszcze raz</button>
        <Link to="/sklep" className="text-foreground/45 hover:text-[#C9A24A] transition-colors">Wróć do Skarbca</Link>
      </div>
    </section>
  );
}