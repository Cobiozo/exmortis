import React from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Grid2x2, List, ChevronRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { CardTopBadge, PriceBlock, isListenProduct, productHref } from "./cardBits";

// Widoki Skarbca obok dotychczasowych kart: „kafelki” (2 w rzędzie na telefonie) i „lista” (zwarte wiersze).
// Kupno i lista oczekujących — na stronie produktu (karta prowadzi tam w całości).
export const SHOP_VIEWS = [["karty", "Karty", LayoutGrid], ["kafelki", "Kafelki", Grid2x2], ["lista", "Lista", List]];
const KEY = "exm_shop_view";
export function loadShopView() {
  try { const v = localStorage.getItem(KEY); return SHOP_VIEWS.some(([k]) => k === v) ? v : "karty"; } catch { return "karty"; }
}
export function saveShopView(v) { try { localStorage.setItem(KEY, v); } catch { /* bez pamięci */ } }

// Przełącznik w przyklejonym pasku filtrów (zawsze pod ręką przy przewijaniu).
export function ShopViewToggle({ view, onChange }) {
  return (
      <div className="flex items-center gap-2">
        <span className="technical text-[9px] text-foreground/55" aria-hidden="true">WIDOK</span>
        <div role="group" aria-label="Widok produktów" className="inline-flex border hairline">
          {SHOP_VIEWS.map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={view === k} title={label}
              className={`flex items-center gap-2 px-2 sm:px-3 py-2 technical text-[10px] transition-colors ${view === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/65 hover:text-[#F5EFE1]"}`}>
              <Icon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{label.toUpperCase()}</span><span className="sr-only sm:hidden">{label}</span>
            </button>
          ))}
        </div>
      </div>
  );
}

function hrefOf(p) {
  return isListenProduct(p) ? (p.checkout_url || "").trim() || "/glos" : productHref(p);
}
function To({ href, children, ...rest }) {
  return href.startsWith("/") ? <Link to={href} {...rest}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
}

export function ShopProductTile({ product: p, index }) {
  const cover = p.cover_image || p.image_url;
  const soon = p.status === "wkrótce";
  return (
    <To href={hrefOf(p)} className={`group flex flex-col h-full border hairline bg-[#0D0D0E] hover:border-[#C9A24A]/40 transition-colors ${soon ? "opacity-80" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0F0F10]">
        {cover ? <Image src={cover} alt="" className="w-full h-full" fittingType="fill" /> : (
          <span className="absolute bottom-2 left-3 shop-heading text-2xl text-[#C9A24A]/25">{String(index ?? "").padStart(2, "0")}</span>
        )}
        <div className="absolute top-2 left-2 flex gap-1 scale-90 origin-top-left"><CardTopBadge p={p} index={index} /></div>
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <h3 className="shop-heading text-sm sm:text-base text-[#F5EFE1] leading-snug line-clamp-2 group-hover:text-[#C9A24A] transition-colors">{p.name}</h3>
        <div className="mt-auto text-sm text-[#F5EFE1]"><PriceBlock p={p} /></div>
      </div>
    </To>
  );
}

export function ShopProductRow({ product: p, index }) {
  const cover = p.cover_image || p.image_url;
  return (
    <To href={hrefOf(p)} className="group flex items-center gap-3 sm:gap-4 py-3 border-b hairline hover:bg-[#0D0D0E] transition-colors">
      <div className="relative w-20 sm:w-28 aspect-[4/3] shrink-0 overflow-hidden bg-[#0F0F10]">
        {cover ? <Image src={cover} alt="" className="w-full h-full" fittingType="fill" /> : (
          <span className="absolute bottom-1 left-2 shop-heading text-lg text-[#C9A24A]/25">{String(index ?? "").padStart(2, "0")}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="shop-heading text-sm sm:text-base text-[#F5EFE1] leading-snug line-clamp-2 group-hover:text-[#C9A24A] transition-colors">{p.name}</h3>
        {(p.form || p.format_details) && <p className="technical text-[9px] text-foreground/55 mt-1 truncate">{[p.form, p.format_details].filter(Boolean).join(" · ").toUpperCase()}</p>}
      </div>
      <div className="text-sm text-[#F5EFE1] text-right shrink-0 max-w-[40%]"><PriceBlock p={p} /></div>
      <ChevronRight className="h-4 w-4 text-foreground/40 shrink-0" aria-hidden="true" />
    </To>
  );
}