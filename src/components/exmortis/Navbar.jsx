import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import Logo from "./Logo";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import DesktopNav, { TestLink } from "./nav/DesktopNav";
import AccountMenu from "./nav/AccountMenu";
import NotificationBell from "./nav/NotificationBell";
import MobileMenu from "./nav/MobileMenu";
import usePrelaunch from "@/lib/usePrelaunch";
import PrelaunchNav from "@/components/prelaunch/PrelaunchNav";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  // navCount = ile pozycji menu mieści się w belce (0 = wszystko w menu rozwijanym pod przyciskiem ☰).
  const [navCount, setNavCount] = useState(0);
  const collapsed = navCount === 0;
  const { count, setOpen } = useCart();
  const { isAdmin } = useAdminMode();
  const location = useLocation();
  const { gated } = usePrelaunch();
  const rowRef = useRef(null), logoRef = useRef(null), rightRef = useRef(null), baseRef = useRef(null), measureRef = useRef(null), burgerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Belka (17.11.2026): pokazuje tyle pozycji, ile się mieści; reszta trafia do „Więcej” obok.
  // Poniżej 768 px albo gdy mieszczą się mniej niż 3 pozycje — całe menu pod przyciskiem ☰ (rozwija się tuż pod nim).
  useLayoutEffect(() => {
    if (!rowRef.current) return;
    const check = () => {
      const m = measureRef.current;
      const items = m ? [...m.querySelectorAll("[data-nav-item]")].map((e) => e.offsetWidth + 2) : [];
      const testW = (m?.querySelector("[data-nav-test]")?.offsetWidth || 0) + 16;
      const avail = (rowRef.current?.clientWidth || 0) - (logoRef.current?.offsetWidth || 0) - (baseRef.current?.offsetWidth || 0) - 56 - testW;
      const MORE = 100;
      let k = items.length;
      if (items.reduce((a, b) => a + b, 0) > avail) {
        k = 0; let sum = 0;
        while (k < items.length && sum + items[k] + MORE <= avail) { sum += items[k]; k++; }
      }
      setNavCount(window.innerWidth < 768 || k < 3 ? 0 : k);
    };
    check();
    document.fonts?.ready?.then(check).catch(() => {});
    const ro = new ResizeObserver(check);
    ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [gated]);

  const close = useCallback(() => { setMobile(false); burgerRef.current?.focus(); }, []);
  useEffect(() => { setMobile(false); }, [location.pathname]);
  useEffect(() => { if (!collapsed) setMobile(false); }, [collapsed]);

  const top = isAdmin ? "top-10" : "top-0";
  if (gated) return <PrelaunchNav top={top} />;
  return (
    <>
      <header className={`fixed ${top} inset-x-0 z-50 transition-colors duration-300 ${scrolled || mobile ? "bg-[#0A0A0B]/95 backdrop-blur-md border-b hairline" : "bg-transparent"}`}>
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <div ref={rowRef} className="relative flex items-center justify-between gap-6 h-[60px] md:h-[72px]">
            {/* niewidoczna kopia menu do pomiaru szerokości */}
            <div aria-hidden="true" className="absolute invisible pointer-events-none -z-10 left-0 top-0"><DesktopNav ref={measureRef} measure /></div>

            <Link ref={logoRef} to="/" aria-label="exmortis — strona główna" className="flex items-center gap-3 shrink-0 whitespace-nowrap min-h-11">
              <Logo className="h-9 w-9 md:h-10 md:w-10" />
              <span className="exm-wordmark relic-heading text-xl gold-text tracking-[0.3em] hidden sm:block">EXMORTIS</span>
            </Link>

            {!collapsed && <DesktopNav className="ml-auto" count={navCount} />}

            <div ref={rightRef} className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Na telefonie „Zrób test” jest na dole menu — w belce od 640 px. */}
              {collapsed && <span className="hidden sm:inline-flex"><TestLink small /></span>}
              <span ref={baseRef} className="flex items-center gap-1 sm:gap-2">
              <NotificationBell />
              <AccountMenu />
              <button onClick={() => setOpen(true)} className="relative p-2 min-h-11 min-w-11 inline-flex items-center justify-center text-foreground/80 hover:gold-text transition-colors" aria-label="Koszyk">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.25} />
                {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#BC1E22] text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">{count}</span>}
              </button>
              </span>
              {collapsed && (
                <button ref={burgerRef} onClick={() => (mobile ? close() : setMobile(true))} className="ml-1 h-11 w-11 inline-flex items-center justify-center rounded-lg border hairline bg-[#111113] text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors"
                  aria-label={mobile ? "Zamknij menu" : "Otwórz menu"} aria-expanded={mobile} aria-controls="mobile-menu">
                  {mobile ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
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