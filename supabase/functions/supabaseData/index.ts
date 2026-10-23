// Bramka danych z kopii Supabase dla zalogowanych (dane kont i panele).
// Reguły dostępu egzekwują moduły supaRead (odczyt) i supaWrite (zapis) —
// identycznie jak reguły encji aplikacji.
import { createClientFromRequest } from "../_shared/compat.ts";
import { supaRead } from "../_shared/supaRead.ts";
import { supaWrite } from "../_shared/supaWrite.ts";

const READ_OPS = new Set(["get", "filter", "list", "count", "aggregate"]);

const handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Logowanie wymagane' }, { status: 401 });

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload.entity !== 'string' || typeof payload.op !== 'string') {
      return Response.json({ error: 'Błędne żądanie' }, { status: 400 });
    }

    const result = READ_OPS.has(payload.op)
      ? await supaRead(base44, user, payload)
      : await supaWrite(base44, user, payload);
    return Response.json({ ok: true, result });
  } catch (e) {
    const forbidden = e && e.forbidden === true;
    console.error('supabaseData:', String(e?.message || e).slice(0, 200));
    return Response.json(
      { error: forbidden ? 'Brak dostępu' : 'Operacja na kopii nie powiodła się' },
      { status: forbidden ? 403 : 500 }
    );
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
