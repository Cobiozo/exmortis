import React, { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";

// Pełne menu w jednej linii; TEST na końcu z ramką.
const DesktopNav = forwardRef(function DesktopNav({ className = "", ...rest }, ref) {
  const { pathname } = useLocation();
  const { menu: NAV } = useSiteNav();
  return (
    <nav ref={ref} aria-label="Menu główne" className={`flex items-center gap-6 xl:gap-9 whitespace-nowrap ${className}`} {...rest}>
      {NAV.map((n) => {
        const on = isActive(pathname, n.to);
        return (
          <Link key={n.to} to={n.to} aria-current={on ? "page" : undefined}
            className={`technical text-[11px] !tracking-[0.12em] xl:!tracking-[0.18em] whitespace-nowrap py-1 border-b transition-colors ${on ? "gold-text border-[#C9A24A]" : "text-foreground/70 hover:gold-text border-transparent"}`}>
            {n.label}
          </Link>
        );
      })}
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
      className={`relative after:absolute after:-inset-2 after:content-[''] technical gold-text border border-[#C9A24A]/70 hover:border-[#C9A24A] hover:text-[#E2C170] whitespace-nowrap transition-colors ${small ? "text-[10px] px-2.5 py-1" : "text-[11px] !tracking-[0.12em] xl:!tracking-[0.18em] px-3 py-1.5"} ${on ? "bg-[#C9A24A]/10" : ""}`}>
      {TEST.label}
    </Link>
  );
}

export default DesktopNav;