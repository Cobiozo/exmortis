import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, clientIp } from "../_shared/supabase.ts";
import { applyDiscount } from "../_shared/discounts.ts";
import { unitPrice } from "../_shared/productPrice.ts";
import { errorResponse } from "../_shared/errors.ts";

// Podgląd rabatu w kasie (ostateczne wyliczenie i tak robi payuCreateOrder).
const handler = async function (req) {
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
    const rows = await runSql(base44, `SELECT id, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
      promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps FROM public.products p WHERE id IN (${ids.map(escStr).join(",")})`, true);
    const price = new Map(rows.map((r) => [String(r.id), Math.round(unitPrice(r) * 100)]));
    const lines = items.filter((i) => price.has(String(i.id))).map((i) => ({
      product_id: String(i.id), unit: price.get(String(i.id)), qty: Math.max(1, Math.min(20, Math.floor(Number(i.qty) || 1))),
    }));
    const r = await applyDiscount(base44, body.code, lines);
    return Response.json({ code: r.code, discount: r.discount / 100 });
  } catch (error) {
    return errorResponse(error, "Nie udało się sprawdzić kodu. Spróbuj ponownie.");
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
