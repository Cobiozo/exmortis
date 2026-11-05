// Jednorazowe zadania wykonane 5.11.2026 (decyzje właściciela):
// - quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
// - kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”;
// - Biblioteka: reguła grup „wszystkie_konta” w bazie i grupa „Wszystkie konta” (Obok → Biblioteka).
// Funkcja wyłączona — każde wywołanie → 410.
Deno.serve(() => Response.json({ error: "Wyłączone", disabled: true }, { status: 410 }));
