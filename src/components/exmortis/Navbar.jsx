import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import Logo from "./Logo";

const NAV = [
  { label: "Powrót", to: "/powrot" },
  { label: "Głos", to: "/glos" },
  { label: "O mnie", to: "/o-mnie" },
  { label: "Sklep", to: "/sklep" },
  { label: "Cisza", to: "/cisza?src=nav" },
  { label: "Spotkania", to: "/spotkania?src=nav" },
  { label: "Kontakt", to: "/#kontakt" },
  { label: "Test", to: "/test?src=nav", gold: true },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const { count, setOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);

  const handleNav = (to) => {
    setMobile(false);
    if (to.includes("#")) {
      const [path, hash] = to.split("#");
      const targetPath = path || "/";
      if (location.pathname !== targetPath) {
        navigate(targetPath);
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
        }, 400);
      } else {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(to);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0A0A0B]/90 backdrop-blur-md border-b hairline"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <Logo className="h-10 w-10" />
              <span className="relic-heading text-xl gold-text tracking-[0.3em] hidden sm:block">
                EXMORTIS
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-10">
              {NAV.map((n) => (
                <button
                  key={n.to}
                  onClick={() => handleNav(n.to)}
                  className={`technical text-[11px] transition-colors duration-300 ${
                    n.gold
                      ? "gold-text hover:text-[#E2C170]"
                      : "text-foreground/70 hover:gold-text"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setOpen(true)}
                className="relative p-2 text-foreground/80 hover:gold-text transition-colors"
                aria-label="Koszyk"
              >
                <ShoppingBag className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#BC1E22] text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">
                    {count}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobile((v) => !v)}
                className="md:hidden p-2 text-foreground"
                aria-label="Menu"
              >
                {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
          mobile ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="absolute inset-0 bg-[#0A0A0B]" onClick={() => setMobile(false)} />
        <div className="relative h-full flex flex-col items-center justify-center gap-8">
          {NAV.map((n, i) => (
            <button
              key={n.to}
              onClick={() => handleNav(n.to)}
              className="relic-heading text-3xl gold-text"
              style={{
                opacity: mobile ? 1 : 0,
                transform: mobile ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.4s ease ${i * 0.08}s`,
              }}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}