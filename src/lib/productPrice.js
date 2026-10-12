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

// Omnibus: najniższa cena z 30 dni przed obniżką (pole omnibus_price, jeśli kiedyś powstanie; inaczej cena regularna —
// prawdziwa, dopóki w ostatnich 30 dniach przed promocją nie było innej obniżki).
export const lowestPrice30 = (p) => (p?.omnibus_price != null ? Number(p.omnibus_price) : regularPrice(p));
export const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;

// Produkt płatny bez ceny (np. mentoring „po rozmowie”) — nie trafia do koszyka.
export const priceOnRequest = (p) => !p?.is_free && !(unitPrice(p) > 0);
