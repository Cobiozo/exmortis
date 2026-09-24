import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Pusta lista wydarzeń: zapowiedź + wejście do Skarbca.
export default function NoEvents() {
  return (
    <div className="max-w-xl">
      <p className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug">
        Kolejne spotkania — już wkrótce.
      </p>
      <p className="mt-5 text-foreground/50 leading-relaxed">
        W międzyczasie zajrzyj do Skarbca — znajdziesz tam drogi powrotu, od których możesz zacząć od razu.
      </p>
      <Link
        to="/sklep?src=spotkania"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 technical text-xs border border-[#C9A24A]/70 text-[#C9A24A] hover:bg-[#C9A24A]/10 hover:border-[#C9A24A] transition-all duration-300 mt-8"
      >
        Zobacz Skarbiec <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}