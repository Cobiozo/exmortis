import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { isActive } from "./navItems";
import { useSiteNav } from "./useSiteNav";

// Menu w belce. Od 17.11.2026 wygląd jak menu Mojego konta: zwykły krój Inter, zaokrąglone podświetlenie,
// aktywna pozycja na złotym tle. Pozycje z desktop: false są tylko w menu telefonu.
// count = ile pozycji mieści się w belce; reszta trafia do rozwijanego „Więcej” tuż pod przyciskiem.
const ITEM = "inline-flex items-center min-h-10 px-2.5 xl:px-3 rounded-lg text-[14px] whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]";
// Aktywna pozycja: złote podświetlenie i złota linia pod etykietą (system wizualny, etap 1).
const itemCls = (on) =>
  `${ITEM} relative ${on
    ? "bg-[#C9A24A]/[0.12] text-[#F5EFE1] after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:bg-[#C9A24A] after:content-['']"
    : "text-[#F5EFE1]/75 hover:text-[#F5EFE1] hover:bg-white/[0.04]"}`;

export const desktopItems = (menu) => menu.filter((n) => n.desktop !== false);

function More({ items }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  const on = items.some((n) => isActive(pathname, n.to));
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
        className={`${itemCls(on)} gap-1`}>
        Więcej <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[200px] rounded-xl border hairline bg-[#0F0F11] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.55)] z-50">
          {items.map((n) => (
            <Link key={n.to} to={n.to} aria-current={isActive(pathname, n.to) ? "page" : undefined}
              className={`${itemCls(isActive(pathname, n.to))} flex w-full`}>{n.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

// measure = niewidoczna kopia do pomiaru szerokości (wszystkie pozycje, bez „Więcej”).
const DesktopNav = forwardRef(function DesktopNav({ className = "", count, measure, ...rest }, ref) {
  const { pathname } = useLocation();
  const { menu } = useSiteNav();
  const all = desktopItems(menu);
  const shown = measure || count == null ? all : all.slice(0, count);
  const hidden = measure || count == null ? [] : all.slice(count);
  return (
    <nav ref={ref} aria-label={measure ? undefined : "Menu główne"} className={`flex items-center gap-0.5 whitespace-nowrap ${className}`} {...rest}>
      {shown.map((n) => {
        const on = isActive(pathname, n.to);
        return (
          <Link key={n.to} to={n.to} data-nav-item="" tabIndex={measure ? -1 : undefined} aria-current={on ? "page" : undefined} className={itemCls(on)}>
            {n.label}
          </Link>
        );
      })}
      {hidden.length > 0 && <More items={hidden} />}
      <span className="w-2 xl:w-3" aria-hidden="true" />
      <span data-nav-test=""><TestLink /></span>
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