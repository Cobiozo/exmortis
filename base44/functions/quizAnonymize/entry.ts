// Jednorazowe zadania wykonane 5.11.2026 (decyzje właściciela):
// - quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
// - kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”;
// - Biblioteka: reguła grup „wszystkie_konta” w bazie i grupa „Wszystkie konta” (Obok → Biblioteka);
// - anonimowy licznik ukończeń testu: tabela test_counts + funkcje test_done / test_stats
//   (SQL: base44/shared/testCountSql.ts; kontrola: 2 funkcje, anon tylko test_done, tabela niedostępna);
// - audyt: „wszystkie_konta” tylko z potwierdzonym adresem (mb_auto_group_emails z librarySchema.ts);
//   kontrola: 6 kont, 6 w grupie, 0 niepotwierdzonych, funkcja niedostępna dla anon;
// - inspekcja PayU (tylko odczyt, sesja administratora) — wykonana 5.11.2026 ok. 20:25, potem wyłączona;
// - logowanie Google na exmortis.pl: ustawienia google_oauth (bez sekretu) i funkcja googleAuth — 6.11.2026, potem wyłączona.
// - wdrożenie PayU (migracja v3, 28 funkcji Supabase z commita 046316db, cronTick przywrócony do v12) — 5.11.2026 ok. 21:45–22:05, potem wyłączona.
// - PayU: odbiór płatności oczekujących i tytuł transakcji (4 funkcje Supabase z commita de11b00a) — 6.11.2026 ok. 17:00–17:20, potem wyłączona.
// - Supabase: 35 funkcji z commita 1dbec296 (stopka maili z danymi nadawcy, Skarbiec: data premiery) — 11.11.2026 ok. 20:40–20:55, potem wyłączona.
// - Supabase: adminNewsletter z commita a03de30f (opcja „pomiń osoby w trakcie serii startowej”) — 12.11.2026 ok. 01:20, potem wyłączona.
// - Supabase: instagramFeed z commita 74a4d70e (zdjęcia Instagrama przez serwer exmortis) — 12.11.2026 ok. 01:40, potem wyłączona.
// - Supabase: payuCreateOrder, payuNotification, cmsScheduled, adminOrders z commita dd9cd5a0 (konto z kasy, krótsza zgoda cyfrowa) — 12.11.2026 ok. 01:55, potem wyłączona.
// - Diagnoza alarmu „listy/zaplanowane — kod 403” i adminNewsletter z commita 55d38e01 (błąd bazy → 503) — 12.11.2026 ok. 19:55–20:10, potem wyłączona.
// - Supabase: 12 funkcji z commita 569be7f8 (płatność POWRÓT, Umowa POWRÓT) — 13.11.2026 ok. 00:50, potem wyłączona.
// - Diagnoza powiadomień POWRÓT (odczyt kolejki poczty) — 13.11.2026 ok. 01:45, potem wyłączona.
// - Supabase: adminOrders z commita 3828f582 (zakładka Darmowe pobrania) — 14.11.2026 ok. 00:00, potem wyłączona.
// Funkcja wyłączona — każde wywołanie → 410.
Deno.serve(() => Response.json({ error: "Wyłączone", disabled: true }, { status: 410 }));
