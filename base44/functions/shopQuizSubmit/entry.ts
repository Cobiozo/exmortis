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

Deno.serve(handler);
