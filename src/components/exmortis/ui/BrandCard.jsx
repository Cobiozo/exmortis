import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// BrandCard — karta marki o stałej budowie:
// media (3:4 dla produktów i treści, 16:9 dla usług i wydarzeń) → etykieta → tytuł → opis → meta → akcja na dole.
// W rzędzie karty mają jednakową wysokość (h-full); akcja zawsze przy dolnej krawędzi.
// featured: wariant poziomy „wyróżniony” (od 768 px media obok treści).
// Użycie: <BrandCard variant="produkt" media={<img … />} label="Ebook" title="…" description="…" meta="PDF · 120 stron"
//                     action={<BrandButton to="/skarbiec/x">Zobacz</BrandButton>} highlight={<ProductHighlight kind="nowosc" />} />
const RATIO = { "3:4": "aspect-[3/4]", "16:9": "aspect-[16/9]" };
const DEFAULT_RATIO = { produkt: "3:4", treść: "3:4", usługa: "16:9", wydarzenie: "16:9", krok: null };

export default function BrandCard({
  variant = "produkt",
  ratio,
  media,
  label,
  title,
  description,
  meta,
  action,
  highlight,
  featured = false,
  step,
  to,
  href,
  className = "",
  children,
}) {
  const r = ratio || DEFAULT_RATIO[variant] || null;
  const interactive = Boolean(to || href);
  const Tag = to ? Link : href ? "a" : "article";
  const linkProps = to
    ? { to }
    : href
      ? { href, target: href.startsWith("http") ? "_blank" : undefined, rel: href.startsWith("http") ? "noopener noreferrer" : undefined }
      : {};

  return (
    <Tag
      {...linkProps}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface transition-colors",
        featured && "md:flex-row",
        interactive && "hover:border-exm-gold-line",
        className
      )}
    >
      {r && media && (
        <div className={cn("relative shrink-0 overflow-hidden bg-exm-surface-2", RATIO[r], featured && "md:aspect-auto md:w-[42%] md:min-h-[260px]")}>
          {media}
          {highlight && <div className="absolute left-3 top-3 z-10">{highlight}</div>}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
        {variant === "krok" && step != null && (
          <span className="exm-h2 leading-none text-exm-gold" aria-hidden="true">{step}</span>
        )}
        {label && <p className="exm-eyebrow">{label}</p>}
        {title && <h3 className="exm-h3 text-balance">{title}</h3>}
        {description && <p className="text-[15px] leading-relaxed text-exm-muted">{description}</p>}
        {children}
        {meta && <p className="technical text-[10px] text-exm-muted">{meta}</p>}
        {action && <div className="mt-auto pt-4">{action}</div>}
      </div>
    </Tag>
  );
}