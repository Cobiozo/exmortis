// Funkcja diagnostyczna (audyt SEC-04, 16.11.2026) — użyta raz do ustalenia nagłówków IP, potem wyłączona.
Deno.serve(() => Response.json({ error: "Wyłączone", disabled: true }, { status: 410 }));
