import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import Logo from "./Logo";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import DesktopNav, { TestLink } from "./nav/DesktopNav";
import AccountMenu from "./nav/AccountMenu";
import MobileMenu from "./nav/MobileMenu";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const { count, setOpen } = useCart();
  const { isAdmin } = useAdminMode();
  const location = useLocation();
  const rowRef = useRef(null), logoRef = useRef(null), rightRef = useRef(null), measureRef = useRef(null), burgerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hamburger poniżej 1100 px albo gdy realna szerokość menu się nie mieści.
  useLayoutEffect(() => {
    const check = () => {
      const row = rowRef.current?.clientWidth || 0;
      const need = (logoRef.current?.offsetWidth || 0) + 24 + (measureRef.current?.scrollWidth || 0) + 24 + (rightRef.current?.offsetWidth || 0);
      setCollapsed(window.innerWidth < 1100 || need > row);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, []);

  const close = useCallback(() => { setMobile(false); burgerRef.current?.focus(); }, []);
  useEffect(() => { setMobile(false); }, [location.pathname]);
  useEffect(() => { if (!collapsed) setMobile(false); }, [collapsed]);

  const top = isAdmin ? "top-10" : "top-0";
  return (
    <>
      <header className={`fixed ${top} inset-x-0 z-50 transition-colors duration-300 ${scrolled || mobile ? "bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline" : "bg-transparent"}`}>
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <div ref={rowRef} className="relative flex items-center justify-between gap-6 h-[60px] md:h-[72px]">
            {/* niewidoczna kopia menu do pomiaru szerokości */}
            <div aria-hidden="true" className="absolute invisible pointer-events-none -z-10 left-0 top-0"><DesktopNav ref={measureRef} /></div>

            <Link ref={logoRef} to="/" aria-label="exmortis — strona główna" className="flex items-center gap-3 shrink-0 whitespace-nowrap">
              <Logo className="h-9 w-9 md:h-10 md:w-10" />
              <span className="relic-heading text-xl gold-text tracking-[0.3em] hidden sm:block">EXMORTIS</span>
            </Link>

            {!collapsed && <DesktopNav className="ml-auto" />}

            <div ref={rightRef} className="flex items-center gap-1 sm:gap-2 shrink-0">
              {collapsed && <TestLink small />}
              <AccountMenu />
              <button onClick={() => setOpen(true)} className="relative p-2 text-foreground/80 hover:gold-text transition-colors" aria-label="Koszyk">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.25} />
                {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#BC1E22] text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">{count}</span>}
              </button>
              {collapsed && (
                <button ref={burgerRef} onClick={() => (mobile ? close() : setMobile(true))} className="p-2 gold-text"
                  aria-label={mobile ? "Zamknij menu" : "Otwórz menu"} aria-expanded={mobile} aria-controls="mobile-menu">
                  {mobile ? <X className="h-6 w-6" strokeWidth={1.25} /> : <Menu className="h-6 w-6" strokeWidth={1.25} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <MobileMenu open={mobile && collapsed} onClose={close} top={isAdmin ? 100 : 60} />
    </>
  );
}