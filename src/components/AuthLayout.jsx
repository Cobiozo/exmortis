import React from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "@/components/exmortis/Logo";
import useLoginText from "@/content/useLoginText";

// Wspólny układ stron logowania — styl exmortis, zakładki Zaloguj / Załóż konto.
export default function AuthLayout({ title, subtitle, footer, children, tabs = false }) {
  const { pathname, search } = useLocation();
  const t = useLoginText();
  const tab = (to, label) => (
    <Link
      to={to + search}
      className={`flex-1 text-center py-3 technical text-[10px] border-b ${
        pathname === to ? "border-[#C9A24A] text-[#C9A24A]" : "border-[#3D3D3F] text-foreground/45 hover:text-[#F5EFE1]"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] px-5 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-6"><Logo className="h-14 w-14" glow={false} /></Link>
          <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1]">{title || t("tytul")}</h1>
          <p className="text-foreground/55 mt-4 leading-relaxed">
            {subtitle || t("podtytul")}
          </p>
        </div>
        {tabs && (
          <div className="flex mb-8">
            {tab("/login", t("zakladka.login"))}
            {tab("/register", t("zakladka.rejestracja"))}
          </div>
        )}
        <div className="border hairline p-6 md:p-8">{children}</div>
        {footer && <p className="text-center text-sm text-foreground/50 mt-6">{footer}</p>}
      </div>
    </div>
  );
}