// Jednorazowe czyszczenie wykonane 5.11.2026 (decyzja właściciela):
// - quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
// - kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”.
// Funkcja wyłączona — każde wywołanie → 410.
Deno.serve(() => Response.json({ error: "Wyłączone", disabled: true }, { status: 410 }));
