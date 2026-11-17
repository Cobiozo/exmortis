import React, { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";

// Pełne menu w jednej linii; „Zrób test” na końcu z ramką. Od 17.11.2026 wygląd jak menu Mojego konta:
// zwykły krój Inter, zaokrąglone podświetlenie, aktywna pozycja na złotym tle. Pozycje z desktop: false są tylko w menu telefonu.
const DesktopNav = forwardRef(function DesktopNav({ className = "", ...rest }, ref) {
  const { pathname } = useLocation();
  const { menu: NAV } = useSiteNav();
  return (
    <nav ref={ref} aria-label="Menu główne" className={`flex items-center gap-0.5 xl:gap-1 whitespace-nowrap ${className}`} {...rest}>
      {NAV.filter((n) => n.desktop !== false).map((n) => {
        const on = isActive(pathname, n.to);
        return (
          <Link key={n.to} to={n.to} aria-current={on ? "page" : undefined}
            className={`inline-flex items-center min-h-10 px-3 xl:px-3.5 rounded-lg text-[14px] whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A] ${on ? "bg-[#C9A24A]/[0.12] text-[#F5EFE1]" : "text-[#F5EFE1]/75 hover:text-[#F5EFE1] hover:bg-white/[0.04]"}`}>
            {n.label}
          </Link>
        );
      })}
      <span className="w-3 xl:w-4" aria-hidden="true" />
      <TestLink />
    </nav>
  );
});

export function TestLink({ small }) {
  const { pathname } = useLocation();
  const { test: TEST } = useSiteNav();
  const on = isActive(pathname, TEST.to);
  return (
    <Link to={TEST.to} aria-current={on ? "page" : undefined}
      className={`relative inline-flex items-center rounded-lg gold-text border border-[#C9A24A]/55 hover:border-[#C9A24A] hover:text-[#E2C170] hover:bg-[#C9A24A]/[0.06] whitespace-nowrap font-medium transition-colors ${small ? "text-[13px] px-3 min-h-9 after:absolute after:-inset-1 after:content-['']" : "text-[14px] px-4 min-h-10"} ${on ? "bg-[#C9A24A]/10" : ""}`}>
      {TEST.label}
    </Link>
  );
}

export default DesktopNav;