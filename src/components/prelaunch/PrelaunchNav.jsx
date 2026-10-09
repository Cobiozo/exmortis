import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/exmortis/Logo";

// Menu w trybie przedpremierowym: logo i przycisk „1 listopada”.
export default function PrelaunchNav({ top }) {
  return (
    <header className={`fixed ${top} inset-x-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-b hairline`}>
      <div className="mx-auto max-w-[1400px] px-5 md:px-10 flex items-center justify-between gap-4 h-[60px] md:h-[72px]">
        <Link to="/" aria-label="exmortis — strona główna" className="flex items-center gap-3">
          <Logo className="h-9 w-9 md:h-10 md:w-10" />
          <span className="relic-heading text-xl gold-text tracking-[0.3em] hidden sm:block">EXMORTIS</span>
        </Link>
        <Link to="/1-listopada" className="btn-relic !py-2.5 !px-5">1 listopada</Link>
      </div>
    </header>
  );
}