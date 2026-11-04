// Jednorazowe czyszczenie starszych wyników testu wykonane 5.11.2026 (16 z 27 wierszy: usunięte imię,
// e-mail, forma zwracania się i zdanie refleksji). Funkcja wyłączona — każde wywołanie → 410.
Deno.serve(() => Response.json({ error: "Wyłączone", disabled: true }, { status: 410 }));
