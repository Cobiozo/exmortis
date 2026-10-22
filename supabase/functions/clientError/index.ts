import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";

// Publiczny zapis błędów przeglądarki (ClientError) z limitem: 10 zgłoszeń na godzinę z jednego IP.
// Limit liczebny w samej encji ClientError (pole ip) — bez rejestru SecurityLog.
// Zapis idzie przez tę funkcję (rola serwisowa); bezpośredni zapis SDK jest zablokowany regułą RLS.
const MAX_GODZINA = 10;
const cut = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const message = cut(body.message, 500).trim();
    if (!message) return Response.json({ error: "Brak treści błędu" }, { status: 400 });
    const url = cut(body.url, 500);
    const stack = cut(body.stack, 2000);
    const browser = cut(body.browser, 300);
    const at = typeof body.at === "string" && body.at.length < 40 ? body.at : new Date().toISOString();

    const ip = clientIp(req);
    if (ip && ip !== "brak") {
      const since = new Date(Date.now() - 3600000).toISOString();
      const recent = await base44.asServiceRole.entities.ClientError
        .filter({ ip, created_date: { $gte: since } }, "-created_date", MAX_GODZINA).catch(() => []);
      const n = Array.isArray(recent) ? recent.length : (recent?.items || []).length;
      if (n >= MAX_GODZINA) {
        // Cicho odrzucamy — klient nie ma z tego powodu przestać działać.
        return Response.json({ ok: true, odrzucone: true });
      }
    }

    await base44.asServiceRole.entities.ClientError.create({ url, message, stack, browser, at, ip });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("clientError", error?.message);
    return Response.json({ error: "Nie udało się zapisać błędu" }, { status: 500 });
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
