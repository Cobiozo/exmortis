import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { applyDiscount } from "../../shared/discounts.ts";

// Podgląd rabatu w kasie (ostateczne wyliczenie i tak robi payuCreateOrder).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Limit: 10 prób na godzinę na IP.
    const ip = clientIp(req);
    const L = base44.asServiceRole.entities.SecurityLog;
    const tries = await L.filter({ type: "rabat", ip, created_date: { $gte: new Date(Date.now() - 3600000).toISOString() } }, "-created_date", 11);
    if (tries.length >= 10) throw new Error("Zbyt wiele prób. Spróbuj za godzinę.");
    await L.create({ type: "rabat", ip, details: String(body.code || "").slice(0, 40) });
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const ids = [...new Set(items.map((i) => String(i?.id || "")).filter(Boolean))];
    if (!ids.length) throw new Error("Koszyk jest pusty");
    const rows = await runSql(base44, `SELECT id, price::float8 AS price FROM public.products WHERE id IN (${ids.map(escStr).join(",")})`, true);
    const price = new Map(rows.map((r) => [String(r.id), Math.round(Number(r.price) * 100)]));
    const lines = items.filter((i) => price.has(String(i.id))).map((i) => ({
      product_id: String(i.id), unit: price.get(String(i.id)), qty: Math.max(1, Math.min(20, Math.floor(Number(i.qty) || 1))),
    }));
    const r = await applyDiscount(base44, body.code, lines);
    return Response.json({ code: r.code, discount: r.discount / 100 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}