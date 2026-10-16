// Stary zapis na webinar 1.11 (sprzed modułu Spotkań) — wyłączony 15.10.2026.
// Zapisy idą przez eventsPublic (action "register"): potwierdzenie, zgody, link do dołączenia, przypomnienia.
// Funkcja nie przyjmuje już danych, żeby nie była otwartą furtką do dopisywania adresów i wysyłki maili.
// TYMCZASOWO (audyt 16.10): ?diag=ip zwraca nagłówki adresu IP wywołującego — do usunięcia po diagnozie.
export default async function (req) {
  if (new URL(req.url).searchParams.get("diag") === "ip") {
    const h = {};
    for (const [k, v] of req.headers) if (/ip|forward|client|real|via|cf-|true-|x-envoy|fly|vercel|deno/i.test(k) && !/cookie|auth/i.test(k)) h[k] = v;
    return Response.json(h);
  }
  return Response.json({ error: "Zapisy przyjmuje strona wydarzenia." }, { status: 410 });
}
