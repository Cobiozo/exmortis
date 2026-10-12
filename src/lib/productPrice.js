// Jedna cena produktu dla karty, strony produktu i koszyka — liczona tak samo jak na serwerze
// (base44/shared/productPrice.ts). Promocja trwa do końca dnia promo_end_date czasu polskiego.
export const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

export function isPromoActive(p) {
  return !!(p && p.promo_end_date && p.price_start != null && String(p.promo_end_date).slice(0, 10) >= warsawToday());
}

export function regularPrice(p) {
  const v = p?.price_regular != null ? Number(p.price_regular) : Number(p?.price);
  return Number.isFinite(v) ? v : 0;
}

export function unitPrice(p) {
  return isPromoActive(p) ? Number(p.price_start) : regularPrice(p);
}

// Produkt płatny bez ceny (np. mentoring „po rozmowie”) — nie trafia do koszyka.
export const priceOnRequest = (p) => !p?.is_free && !(unitPrice(p) > 0);
