import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql } from "../_shared/supabase.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";
import { replicateFull, replicateDelta, replikacjaStatus } from "../_shared/replicate.ts";

// Replikacja danych do kopii w Supabase (tabele exm_*).
// Przyrost co 5 minut (Zadania cykliczne → ten tick, token zadania z mb_settings).
// Pełna kopia (action: "full") tylko z sesji administratora — jednorazowo, z wznawianiem.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const me = await base44.auth.me().catch(() => null);
    const admin = me?.role === "admin";

    let tokenOk = false;
    if (typeof body.tick_token === "string" && body.tick_token) {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows && rows[0] ? String(rows[0].tick_token || "") : "";
      tokenOk = !!stored && safeEqual(String(body.tick_token), stored);
    }
    if (!admin && !tokenOk) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (body.action === "full") {
      if (!admin && !tokenOk) return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await replicateFull(base44, { only: body.entity }));
    }
    if (body.action === "status") return Response.json(await replikacjaStatus(base44));
    return Response.json(await replicateDelta(base44, {}));
  } catch (error) {
    console.error("replicateTick:", String(error?.message || error).slice(0, 300));
    return Response.json({ error: "Błąd replikacji" }, { status: 500 });
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
