# Skan bezpieczeństwa — 2026-10-13

## Zmiany z dnia
- **Następny krok** (`shared/nextStep.ts`): zapytania tylko do odczytu, identyfikatory przez `escStr`, w mailu escapowanie HTML. Ryzyko: niskie.
- **Przypomnienie o płatności** (`shared/unpaidReminder.ts`): uruchamiane tylko z zadania cyklicznego. Najpierw oznacza `reminded_at` (atomowo), dopiero potem wysyła, więc nie ma podwójnych wysyłek. Adresat to tylko kupujący z zamówienia. Ryzyko: niskie.
- **Premiera o czasie** (`releaseDue`): zmienia tylko produkty `wkrótce` z minionym `release_at`, lista oczekujących dostaje maile partiami, każda osoba najwyżej raz.

## Ryzyka otwarte
1. `cmsScheduled` można wywołać bez logowania. Działa tylko na zaplanowanych danych, ale ktoś może wywoływać go częściej (obciążenie). Zalecenie: token jak w `libraryTick`.
2. Wylogowanie ze wszystkich urządzeń jest niemożliwe (ograniczenie platformy).
3. Podpisane linki do plików działają do 1 godziny, więc link przekazany dalej działa do wygaśnięcia.
4. Klucz service_role Supabase jest trzymany w pamięci instancji (1 h). Nie trafia do logów ani odpowiedzi.
5. Poczta: dopóki SMTP nie jest skonfigurowane, przypomnienia i listy oczekujących nie wychodzą (bez utraty danych).