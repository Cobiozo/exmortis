// Cena produktu po stronie serwera — ta sama reguła co src/lib/productPrice.js.
// Promocja (price_start) obowiązuje do końca dnia promo_end_date czasu polskiego.
export const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

export function unitPrice(p: Record<string, unknown>): number {
  const end = p.promo_end_date ? String(p.promo_end_date).slice(0, 10) : "";
  if (end && p.price_start != null && end >= warsawToday()) return Number(p.price_start);
  return p.price_regular != null ? Number(p.price_regular) : Number(p.price);
}
