import React from "react";
import { Link } from "react-router-dom";

// Wspólne elementy kart Skarbca: znaczek etapu, cena, przycisk.

const STAGE_BADGE_CLS = {
  "Śmierć": "bg-[#4A3320] text-[#F5EFE1]",
  "Próg": "bg-[#C9A24A] text-[#0A0A0B]",
  "Powrót": "bg-[#5C1A1B] text-[#F5EFE1]",
  "Inny": "bg-[#5C6247] text-[#F5EFE1]",
};

export function StageBadge({ stage }) {
  if (!stage || stage === "Wszystkie") return null;
  return (
    <span className={`technical text-[9px] px-2.5 py-1 ${STAGE_BADGE_CLS[stage] || "bg-[#26262A] text-foreground/70"}`}>
      {stage.toUpperCase()}
    </span>
  );
}

export function isPromoActive(p) {
  return !!(p.promo_end_date && new Date(`${p.promo_end_date}T23:59:59`) > new Date());
}

export function PriceBlock({ p }) {
  if (p.status === "wkrótce") {
    return <span className="technical text-[10px] text-foreground/40">WKRÓTCE</span>;
  }
  if (p.is_free) {
    return <span className="text-[#C9A24A]">bezpłatnie</span>;
  }
  if (isPromoActive(p) && p.price_start != null) {
    const until = new Date(`${p.promo_end_date}T12:00:00`).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
    });
    return (
      <span className="flex items-baseline gap-2 flex-wrap">
        <s className="text-foreground/40">{p.price_regular} zł</s>
        <span className="text-[#C9A24A] text-lg">{p.price_start} zł</span>
        <span className="technical text-[9px] text-foreground/40">DO {until.toUpperCase()}</span>
      </span>
    );
  }
  if (p.price_regular != null) {
    return <span>{p.price_regular} zł</span>;
  }
  return null;
}

export function productHref(p) {
  const url = (p.checkout_url || "").trim();
  return url || `/produkt/${p.slug}`;
}

export function ProductButton({ p, onWaitlist }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-3 technical text-[10px] w-full transition-all duration-300";
  if (p.status === "wkrótce") {
    return (
      <button
        onClick={() => onWaitlist && onWaitlist(p)}
        className={`${base} border border-[#5C1A1B] text-[#E0B9B9] hover:bg-[#5C1A1B]/25`}
      >
        Zapisz się na listę oczekujących
      </button>
    );
  }
  const href = productHref(p);
  const cls = `${base} border border-[#C9A24A]/70 text-[#C9A24A] hover:bg-[#C9A24A]/10 hover:border-[#C9A24A]`;
  return href.startsWith("/") ? (
    <Link to={href} className={cls}>
      {p.button_label || "Zobacz"}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {p.button_label || "Zobacz"}
    </a>
  );
}