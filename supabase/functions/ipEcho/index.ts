// TYMCZASOWA funkcja diagnostyczna (audyt SEC-04, 16.11.2026): pokazuje WYŁĄCZNIE nagłówki IP żądania,
// które ją wywołało (bez danych z bazy). Służy do ustalenia, którym nagłówkom można ufać przy limitach prób.
// Po diagnozie zastąpiona odpowiedzią 410.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const h = (k: string) => (req.headers.get(k) || "").slice(0, 300);
  return Response.json({
    "cf-connecting-ip": h("cf-connecting-ip"),
    "true-client-ip": h("true-client-ip"),
    "x-forwarded-for": h("x-forwarded-for"),
    "x-real-ip": h("x-real-ip"),
    "x-client-ip": h("x-client-ip"),
    "forwarded": h("forwarded"),
    "via": h("via"),
  }, { headers: CORS });
});
