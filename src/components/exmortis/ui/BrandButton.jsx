import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// BrandButton — jeden przycisk marki. Warianty: primary (złoty), secondary (obramowany), link (złoty link).
// Adres wewnętrzny: to="/powrot" · zewnętrzny: href="https://…" · zwykły przycisk: onClick.
// loading: pokazuje kółko i ustawia aria-busy; szerokość przycisku się nie zmienia.
// Użycie: <BrandButton to="/skarbiec">Zobacz Skarbiec</BrandButton>
//         <BrandButton variant="secondary" onClick={save} loading={saving}>Zapisz</BrandButton>
const VARIANTS = { primary: "btn-relic", secondary: "btn-ghost", link: "btn-link" };

export default function BrandButton({
  variant = "primary",
  to,
  href,
  loading = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const cls = cn(VARIANTS[variant] || VARIANTS.primary, loading && "relative", className);
  const inner = (
    <>
      <span className={loading ? "opacity-30" : undefined}>{children}</span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </>
  );
  const busy = loading ? { "aria-busy": "true" } : {};

  if (to) {
    return <Link to={to} className={cls} {...busy} {...rest}>{inner}</Link>;
  }
  if (href) {
    const ext = href.startsWith("http");
    return (
      <a href={href} className={cls} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined} {...busy} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} disabled={disabled || loading} {...busy} {...rest}>
      {inner}
    </button>
  );
}