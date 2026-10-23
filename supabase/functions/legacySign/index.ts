// Podpis pliku ze starego magazynu (Base44) dla funkcji przeniesionych na Supabase
// (docs/tech/MIGRACJA.md, krok 5 — migracja plików). Wywołanie tylko z kodu serwerowego,
// z podpisem HMAC kluczem BOOKING_HMAC_KEY (ten sam sekret po obu stronach).
import { createClientFromRequest } from "../_shared/compat.ts";
import { secrets } from "../_shared/shim.ts";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const handler = async function(req: Request): Promise<Response> {
  try {
    const { uri, sig, expires_in } = await req.json().catch(() => ({} as any));
    if (typeof uri !== "string" || !uri || typeof sig !== "string") {
      return Response.json({ error: "Błędne żądanie" }, { status: 400 });
    }
    const key = secrets.get("BOOKING_HMAC_KEY");
    if (!key) return Response.json({ error: "Brak konfiguracji podpisu" }, { status: 500 });
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = hex(await crypto.subtle.sign("HMAC", k, enc.encode(`sign:${uri}`)));
    let diff = 0;
    if (sig.length !== expected.length) diff = 1;
    else for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const base44 = createClientFromRequest(req);
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: uri,
      expires_in: Math.max(60, Math.min(Number(expires_in) || 3600, 3600)),
    });
    return Response.json({ signed_url });
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
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
