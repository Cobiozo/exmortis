import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useCart } from "../CartContext";
import { isPromoActive, priceOnRequest } from "@/lib/productPrice";

// Wspólne elementy kart Skarbca: znaczki, cena, przycisk.

// Produkty wyłączone z katalogu Skarbca (mają własne podstrony).
export const EXCLUDED_SLUGS = ["listy-powrotu", "test-ktorej-smierci", "minutnik-ciszy"];

// Podcasty i muzyka — bez koszyka; karta otwiera nagranie.
export function isListenProduct(p) {
  return (
    p.form === "Słucham" &&
    (p.is_free || p.slug === "soundtrack-powrotu") &&
    p.slug !== "kanal-whatsapp"
  );
}

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

// Górny znaczek karty: darmowe produkty dostają „NN · DARMOWE”.
export function CardTopBadge({ p, index }) {
  if (p.is_free && index != null) {
    return (
      <span className="technical text-[9px] px-2.5 py-1 bg-[#C9A24A] text-[#0A0A0B]">
        {String(index).padStart(2, "0")} · DARMOWE
      </span>
    );
  }
  return <StageBadge stage={p.stage} />;
}

export { isPromoActive } from "@/lib/productPrice";

export function PriceBlock({ p }) {
  if (p.status === "wkrótce") {
    return <span className="technical text-[10px] text-foreground/40">WKRÓTCE</span>;
  }
  if (p.is_free) {
    return <span>0 zł</span>;
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
  if (priceOnRequest(p)) {
    return <span className="technical text-[10px] text-foreground/60">PO ROZMOWIE</span>;
  }
  if (p.price_regular != null) {
    return <span>{p.price_regular} zł</span>;
  }
  return <span>{p.price} zł</span>;
}

export function productHref(p) {
  const url = (p.checkout_url || "").trim();
  return url || `/skarbiec/${p.slug}`;
}

export function ProductButton({ p, onWaitlist }) {
  const { addItem } = useCart();
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-3 technical text-[10px] w-full transition-all duration-300";
  const cls = `${base} border border-[#C9A24A]/70 text-[#C9A24A] hover:bg-[#C9A24A]/10 hover:border-[#C9A24A]`;

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

  // Podcasty i muzyka: cała karta jest klikalna — przycisk tylko sygnalizuje akcję.
  if (isListenProduct(p)) {
    return (
      <span className={`${base} border border-[#C9A24A]/70 text-[#C9A24A]`}>
        Posłuchaj <ArrowRight className="h-3.5 w-3.5" />
      </span>
    );
  }

  const url = (p.checkout_url || "").trim();
  if (url) {
    const label = p.button_label || "Zobacz";
    return url.startsWith("/") ? (
      <Link to={url} className={cls}>
        {label}
      </Link>
    ) : (
      <a href={url} target="_blank" rel="noreferrer" className={cls}>
        {label}
      </a>
    );
  }

  if (p.is_free) {
    return (
      <Link to={`/skarbiec/${p.slug}`} className={cls}>
        Pobierz <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (priceOnRequest(p)) {
    return (
      <Link to={`/skarbiec/${p.slug}`} className={cls}>
        Zobacz <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <button onClick={() => addItem(p)} className={cls}>
      Do koszyka <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}