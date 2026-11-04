// Test „Która śmierć jest Twoja?” — od 4.11.2026 działa WYŁĄCZNIE w przeglądarce (src/pages/Test.jsx,
// src/lib/quizScore.js). Ta funkcja nie liczy, nie zapisuje i nie wysyła wyników e-mailem.
// Treść żądania nie jest czytana ani logowana. Zostaje tylko jako bezpieczna odpowiedź dla kart
// przeglądarki otwartych przed zmianą (każde wywołanie → 410, bez skutków ubocznych).
const handler = async function (_req) {
  return Response.json(
    { error: "Test działa teraz w całości w Twojej przeglądarce. Odśwież stronę testu.", disabled: true },
    { status: 410 },
  );
};

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