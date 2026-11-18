import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/exmortis/Logo";

// Wspólny układ stron logowania, rejestracji i haseł (etap 12).
// Sygnet EXMORTIS nad kartą, jedna karta (maks. 440 px) z tytułem H1 i jednym zdaniem opisu.
// Pod kartą korzyść z konta i informacja o zakupie bez konta; przejścia między widokami jako btn-link.
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <main className="min-h-[100svh] bg-exm-bg px-[var(--exm-pad)] py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-[440px] flex-col items-center">
        <Link to="/" className="inline-flex min-h-12 items-center" aria-label="exmortis, strona główna">
          <Logo className="h-10 w-10" glow={false} />
        </Link>
        <p aria-hidden="true" className="exm-wordmark mt-3 text-[13px] text-exm-ivory">exmortis</p>

        <div className="mt-7 w-full rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 sm:p-8">
          <h1 className="relic-heading text-[26px] leading-[1.15] sm:text-[30px]">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-exm-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>

        <p className="mt-6 max-w-[42ch] text-center text-[13px] leading-relaxed text-exm-muted">
          Konto prowadzi Cię przez zakupy, Bibliotekę, ROZDROŻA oraz sekcje POWRÓT i Rozmowa na progu. Zakup bez konta pozostaje możliwy.
        </p>

        {footer && <div className="mt-2 text-center">{footer}</div>}
      </div>
    </main>
  );
}