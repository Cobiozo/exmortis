// Kody rabatowe: weryfikacja i wyliczenie rabatu (w groszach) po stronie serwera.
// lines: [{ product_id, unit, qty }] — ceny w groszach.
export async function applyDiscount(base44, rawCode, lines) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const found = (await base44.asServiceRole.entities.DiscountCode.filter({ code, active: true }))[0];
  if (!found) throw new Error("Nieprawidłowy kod rabatowy");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (found.valid_until && found.valid_until < today) throw new Error("Kod rabatowy wygasł");
  if (found.max_uses && (found.uses || 0) >= found.max_uses) throw new Error("Kod rabatowy został już wykorzystany");
  const ids = found.product_ids || [];
  const base = lines
    .filter((l) => ids.length === 0 || ids.includes(String(l.product_id)))
    .reduce((s, l) => s + l.unit * l.qty, 0);
  if (base === 0) throw new Error("Kod nie obejmuje produktów w koszyku");
  const off = found.kind === "kwota"
    ? Math.min(base, Math.round(found.value * 100))
    : Math.round((base * Math.min(100, found.value)) / 100);
  return { record: found, code, discount: off };
}