import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";

// Strona /karta: karta podarunkowa po kluczu z linku (32 losowe znaki; klucz zna tylko kupujący i ten, komu go przekaże).
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
    // Klucz jest losowy, ale publiczny adres nie może służyć do zgadywania seriami: 30 odczytów na godzinę z jednego połączenia.
    if (!(await ipAllowed(base44, clientIp(req), "karta", 30, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
    const c = (await base44.asServiceRole.entities.DiscountCode.filter({ gift_token: token }))[0];
    if (!c) return Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    return Response.json({
      value: c.value, code: c.code, until: c.valid_until, to_name: c.gift_to || "", message: c.gift_message || "",
      used: (Number(c.uses) || 0) >= (Number(c.max_uses) || 1) || c.active === false,
      expired: !!c.valid_until && String(c.valid_until) < today,
    });
  } catch {
    return Response.json({ error: "Nie udało się wczytać karty" }, { status: 500 });
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
