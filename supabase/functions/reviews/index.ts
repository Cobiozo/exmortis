import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr } from "../_shared/supabase.ts";
import { ensureReviewsTable, plainText, defaultName, consentText, REVIEW_MIN, REVIEW_MAX, MAX_PER_HOUR } from "../_shared/reviews.ts";

// Opinie kupujących.
// product — publiczna lista opinii produktu (tylko podpis, ocena, treść, odpowiedź i data).
// mine    — z których zamówień zalogowana osoba może ocenić produkt.
// save    — wystawienie opinii; wszystko sprawdzane po stronie serwera.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "product");
    await ensureReviewsTable(base44).catch(() => {});

    if (action === "product") {
      const pid = String(body.product_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(pid)) return Response.json({ reviews: [], count: 0, avg: null });
      const [rows, agg] = await Promise.all([
        runSql(base44, `SELECT display_name, rating, body, reply, published_at
          FROM public.product_reviews WHERE product_id = ${escStr(pid)} AND status = 'opublikowana'
          ORDER BY published_at DESC LIMIT 50`, true).catch(() => []),
        runSql(base44, `SELECT count(*)::int AS count, round(avg(rating)::numeric, 1)::float8 AS avg
          FROM public.product_reviews WHERE product_id = ${escStr(pid)} AND status = 'opublikowana'`, true).catch(() => []),
      ]);
      return Response.json({
        reviews: (rows || []).map((r) => ({
          display_name: r.display_name,
          rating: Number(r.rating) || 0,
          body: r.body,
          reply: r.reply || null,
          published_at: r.published_at,
        })),
        count: Number(agg?.[0]?.count) || 0,
        avg: agg?.[0]?.avg != null ? Number(agg[0].avg) : null,
      });
    }

    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    const email = String(me.email).toLowerCase();

    // Zamówienia opłacone co najmniej 7 dni temu, z produktem (bez kart podarunkowych).
    if (action === "mine") {
      const orders = await runSql(
        base44,
        `SELECT id::text AS id, buyer_name, items, COALESCE(updated_date, created_date)::timestamptz AS paid
         FROM public.orders WHERE lower(buyer_email) = ${escStr(email)} AND status = 'COMPLETED'
           AND COALESCE(updated_date, created_date) < now() - interval '7 days'
         ORDER BY created_date DESC LIMIT 50`,
        true
      ).catch(() => []);
      const pairs = [];
      for (const o of orders || []) {
        for (const it of Array.isArray(o.items) ? o.items : []) {
          const pid = it?.product_id ? String(it.product_id) : "";
          if (pid && !it.gift) pairs.push({ order_id: String(o.id), product_id: pid, name: String(it.name || ""), buyer_name: o.buyer_name });
        }
      }
      const pids = [...new Set(pairs.map((p) => p.product_id))];
      const prods = pids.length
        ? await runSql(base44, `SELECT id::text AS id, name, product_type FROM public.products WHERE id::text IN (${pids.map(escStr).join(",")})`, true).catch(() => [])
        : [];
      const byId = new Map((prods || []).map((p) => [String(p.id), p]));
      const mine = await runSql(base44, `SELECT order_id, product_id, status FROM public.product_reviews WHERE lower(email) = ${escStr(email)}`, true).catch(() => []);
      const byPair = new Map((mine || []).map((r) => [`${r.order_id}:${r.product_id}`, String(r.status)]));
      const items = pairs
        .filter((p) => { const pr = byId.get(p.product_id); return pr && pr.product_type !== "karta"; })
        .map((p) => ({
          order_id: p.order_id,
          product_id: p.product_id,
          product_name: byId.get(p.product_id)?.name || p.name,
          default_name: defaultName(p.buyer_name),
          status: byPair.get(`${p.order_id}:${p.product_id}`) || null,
        }));
      return Response.json({ items, can_review: items.filter((i) => !i.status).length });
    }

    if (action === "save") {
      const orderId = String(body.order_id || "").slice(0, 60);
      const pid = String(body.product_id || "");
      if (!orderId || !/^[0-9a-f-]{36}$/i.test(pid)) return Response.json({ error: "Nieprawidłowe zamówienie" }, { status: 400 });
      const rating = Math.round(Number(body.rating));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return Response.json({ error: "Wybierz ocenę od 1 do 5" }, { status: 400 });
      const text = plainText(body.body, { min: REVIEW_MIN, max: REVIEW_MAX, label: "Opinia" });
      const name = plainText(body.display_name, { min: 2, max: 40, label: "Podpis" });
      if (body.consent !== true) return Response.json({ error: "Potrzebuję zgody na publikację opinii" }, { status: 400 });

      // Limit: 10 opinii na godzinę z jednego konta.
      const recent = await runSql(
        base44,
        `SELECT count(*)::int AS c FROM public.product_reviews WHERE lower(email) = ${escStr(email)} AND created_at > now() - interval '1 hour'`,
        true
      ).catch(() => []);
      if ((Number(recent?.[0]?.c) || 0) >= MAX_PER_HOUR) {
        return Response.json({ error: "Limit opinii na godzinę został wykorzystany. Spróbuj później." }, { status: 429 });
      }

      // Zamówienie musi należeć do zalogowanej osoby, być opłacone co najmniej 7 dni temu i zawierać ten produkt.
      const rows = await runSql(
        base44,
        `SELECT id::text AS id, items FROM public.orders
         WHERE id::text = ${escStr(orderId)} AND lower(buyer_email) = ${escStr(email)} AND status = 'COMPLETED'
           AND COALESCE(updated_date, created_date) < now() - interval '7 days' LIMIT 1`,
        true
      ).catch(() => []);
      const order = rows?.[0];
      if (!order) return Response.json({ error: "Z tego zamówienia nie można jeszcze wystawić opinii" }, { status: 403 });
      const item = (Array.isArray(order.items) ? order.items : []).find((i) => String(i?.product_id) === pid && !i?.gift);
      if (!item) return Response.json({ error: "Ten produkt nie pochodzi z tego zamówienia" }, { status: 403 });
      const prod = await runSql(base44, `SELECT product_type FROM public.products WHERE id::text = ${escStr(pid)} LIMIT 1`, true).catch(() => []);
      if (!prod?.length || prod[0].product_type === "karta") return Response.json({ error: "Tego produktu nie można oceniać" }, { status: 403 });

      const ins = await runSql(
        base44,
        `INSERT INTO public.product_reviews
           (product_id, order_id, email, display_name, rating, body, status, consent_text, consent_at)
         VALUES (${escStr(pid)}, ${escStr(orderId)}, ${escStr(email)}, ${escStr(name)}, ${rating}, ${escStr(text)},
                 'oczekuje', ${escStr(consentText(name))}, now())
         ON CONFLICT (order_id, product_id) DO NOTHING RETURNING id`
      ).catch(() => []);
      if (!ins?.length) return Response.json({ error: "Opinia dla tego produktu z tego zamówienia już istnieje" }, { status: 409 });
      return Response.json({ ok: true, status: "oczekuje" });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    const bad = /^(Opinia|Podpis|Odpowiedź)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
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
