import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { applyDiscount } from "../../shared/discounts.ts";
import { unitPrice, omnibusPrices, warsawToday } from "../../shared/productPrice.ts";
import { errorResponse } from "../../shared/errors.ts";

// Podgląd rabatu w kasie (ostateczne wyliczenie i tak robi payuCreateOrder).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Limit: 10 prób na godzinę na IP (IP wyłącznie z nagłówków ustawianych przez brzeg platformy).
    const ip = clientIp(req);
    const L = base44.asServiceRole.entities.SecurityLog;
    const tries = await L.filter({ type: "rabat", ip, created_date: { $gte: new Date(Date.now() - 3600000).toISOString() } }, "-created_date", 11);
    if (tries.length >= 10) throw new Error("Zbyt wiele prób. Spróbuj za godzinę.");
    await L.create({ type: "rabat", ip, details: String(body.code || "").slice(0, 40) });
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const ids = [...new Set(items.map((i) => String(i?.id || "")).filter(Boolean))];
    if (!ids.length) throw new Error("Koszyk jest pusty");
    // Ta sama cena co w kasie (z promocją), żeby podgląd rabatu zgadzał się z płatnością.
    const rows = await runSql(base44, `SELECT id, name, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
      promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps FROM public.products p WHERE id IN (${ids.map(escStr).join(",")})`, true);
    const price = new Map(rows.map((r) => [String(r.id), Math.round(unitPrice(r) * 100)]));
    const lines = items.filter((i) => price.has(String(i.id))).map((i) => ({
      product_id: String(i.id), unit: price.get(String(i.id)), qty: Math.max(1, Math.min(20, Math.floor(Number(i.qty) || 1))),
    }));
    const r = await applyDiscount(base44, body.code, lines, typeof body.email === "string" ? body.email.slice(0, 200) : "");
    // Omnibus: najniższa cena z 30 dni przed obniżką kodem — dla każdego produktu objętego rabatem.
    const today = warsawToday();
    const from = new Date(`${today}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - 30);
    const fromS = from.toISOString().slice(0, 10);
    const hist = await omnibusPrices(base44, r.eligible || []);
    const byId = new Map(rows.map((x) => [String(x.id), x]));
    const lowest = (r.eligible || []).map((id) => {
      const now = (price.get(id) || 0) / 100;
      const past = (hist.get(id) || []).filter((h) => h.day < today && h.day >= fromS).map((h) => Number(h.price));
      return { name: String(byId.get(id)?.name || ""), price: Math.min(now, ...past) };
    });
    return Response.json({ code: r.code, discount: r.discount / 100, lowest });
  } catch (error) {
    return errorResponse(error, "Nie udało się sprawdzić kodu. Spróbuj ponownie.");
  }
}