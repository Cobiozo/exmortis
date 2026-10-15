// Stary zapis na webinar 1.11 (sprzed modułu Spotkań) — wyłączony 15.10.2026.
// Zapisy idą przez eventsPublic (action "register"): potwierdzenie, zgody, link do dołączenia, przypomnienia.
// Funkcja nie przyjmuje już danych, żeby nie była otwartą furtką do dopisywania adresów i wysyłki maili.
export default async function () {
  return Response.json({ error: "Zapisy przyjmuje strona wydarzenia." }, { status: 410 });
}
