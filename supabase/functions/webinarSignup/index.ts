// Stary zapis na webinar 1.11 (sprzed modułu Spotkań) — wyłączony 15.10.2026.
// Zapisy idą przez eventsPublic (action "register"): potwierdzenie, zgody, link do dołączenia, przypomnienia.
// Funkcja nie przyjmuje już danych, żeby nie była otwartą furtką do dopisywania adresów i wysyłki maili.
const handler = async function () {
  return Response.json({ error: "Zapisy przyjmuje strona wydarzenia." }, { status: 410 });
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
