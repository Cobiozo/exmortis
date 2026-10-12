import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/exmortis/Logo";

// Menu w trybie przedpremierowym: logo i przycisk do spotkania 1 listopada.
// Na stronie spotkania przycisk prowadzi od razu do formularza zapisu.
export default function PrelaunchNav({ top }) {
  const { pathname } = useLocation();
  const onEvent = pathname === "/1-listopada";
  const cls = "btn-relic !py-2.5 !px-4 sm:!px-5 whitespace-nowrap";
  return (
    <header className={`fixed ${top} inset-x-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-b hairline`}>
      <div className="mx-auto max-w-[1400px] px-5 md:px-10 flex items-center justify-between gap-4 h-[60px] md:h-[72px]">
        <Link to="/" aria-label="exmortis — strona główna" className="flex items-center gap-3">
          <Logo className="h-9 w-9 md:h-10 md:w-10" />
          <span className="relic-heading text-xl gold-text tracking-[0.3em] hidden sm:block">EXMORTIS</span>
        </Link>
        {onEvent ? (
          <a href="#zapis" className={cls}>ZAPISZ SIĘ <ArrowRight className="h-4 w-4" /></a>
        ) : (
          <Link to="/1-listopada" className={cls}>DOWIEDZ SIĘ WIĘCEJ <ArrowRight className="h-4 w-4" /></Link>
        )}
      </div>
    </header>
  );
}
