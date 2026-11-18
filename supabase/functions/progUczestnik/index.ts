// Rozmowa na progu — sekcja w koncie uczestnika (18.11.2026). Wyłącznie własne zgłoszenia (e-mail zalogowanego konta).
// Akcje: me (status, termin, podsumowanie), read (oznaczenie podsumowania jako przeczytanego),
// pay_link (nowy osobisty link do płatności dla zgłoszenia czekającego na płatność).
import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, textField } from "../_shared/supabase.ts";
import { progSync, progLog, STATUS_LABEL, newToken, tokenHash, PAY_DAYS } from "../_shared/prog.ts";

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 });
    const email = String(me.email).trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const a = String(body.action || "me");

    const mine = async (id: string) => {
      const r = await runSql(base44, `SELECT id, status FROM public.prog_applications WHERE id = ${escStr(id)}::uuid AND lower(email) = ${escStr(email)}`, true);
      if (!r.length) throw new Error("Nie ma takiego zgłoszenia.");
      return r[0];
    };

    if (a === "read") {
      const app = await mine(textField(body, "id", { max: 60 }));
      await runSql(base44, `UPDATE public.prog_summaries SET read_at = COALESCE(read_at, now()) WHERE application_id = ${escStr(app.id)}::uuid AND status = 'wyslane'`);
      return Response.json({ ok: true });
    }

    if (a === "pay_link") {
      const app = await mine(textField(body, "id", { max: 60 }));
      if (app.status !== "do_platnosci") return Response.json({ error: "To zgłoszenie nie czeka na płatność." }, { status: 400 });
      const token = newToken();
      await runSql(base44, `UPDATE public.prog_applications SET pay_token_hash = ${escStr(await tokenHash(token))},
        pay_expires_at = now() + interval '${PAY_DAYS} days', updated_date = now() WHERE id = ${escStr(app.id)}::uuid`);
      await progLog(base44, app.id, "system", "Nowy link do płatności z konta uczestnika", "uczestnik");
      return Response.json({ ok: true, token });
    }

    await progSync(base44).catch(() => 0);
    const rows = await runSql(base44, `SELECT a.id, a.created_date, a.status, a.status_at, a.podsumowanie_chce, a.pay_expires_at,
        k.starts_at, k.ends_at, k.status AS booking_status,
        s.status AS summary_status, CASE WHEN s.status = 'wyslane' THEN s.tresc END AS summary, s.shared_at, s.read_at
      FROM public.prog_applications a
        LEFT JOIN public.bk_bookings k ON k.id = a.booking_id
        LEFT JOIN public.prog_summaries s ON s.application_id = a.id
      WHERE lower(a.email) = ${escStr(email)} AND a.status <> 'zamkniete'
      ORDER BY a.created_date DESC LIMIT 20`, true);
    return Response.json({ has: rows.length > 0, items: rows.map((r) => ({ ...r, status_label: STATUS_LABEL[r.status] || r.status })) });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 400 });
  }
};

// === Supabase Edge ===
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
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status: 500, headers: CORS });
  }
});
