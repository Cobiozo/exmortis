# Zadania cykliczne (workflows Base44)

> Plik generowany skryptem z kodu (docs/tech/generuj.mjs) — po zmianach uruchom ponownie: `node docs/tech/generuj.mjs`.

Pliki: `base44/workflows/*.jsonc`. Wywołują funkcje serwera z tokenem (`tick_token`) zapisanym w pliku — workflow Base44 nie czyta sekretów. Od 14.10.2026 całe tło obsługuje **jeden workflow „Zadania cykliczne”** (`*/5 * * * *`, czas polski → funkcja `cronTick`, która równolegle robi to samo, co dawniej sześć osobnych workflowów). Sześć starych plików jest **wyłączonych, nie usuniętych** — zostają jako wzorzec i historia. Po migracji: zwykły cron wołający te same adresy z tym samym tokenem.

| Plik | Nazwa | Co robi | Harmonogram | Funkcja |
|---|---|---|---|---|
| BibliotekaTick.jsonc | Biblioteka — wysyłka i higiena danych | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (co 5 minut). Co 5 minut: wysyła wiadomości zaplanowane na teraz (atomowe przejęcie, najwyżej 20 na godzinę), wysyła zbiorcze powiadomienia o nowych materiałach i czy | */5 * * * * | libraryTick |
| CmsZaplanowane.jsonc | Strony — publikacje zaplanowane | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (co 5 minut). Co 5 minut publikuje strony z edytora, których termin publikacji już minął. | */5 * * * * | cmsScheduled |
| DolaczSzczyt.jsonc | Rozgrzewanie strony dołączenia 1.11 | 1 listopada 19:00–20:59 (czas polski): uruchamiane co 5 minut, w środku pinguje stronę /dolacz co minutę. | */5 19-20 1 11 * | eventsPublic |
| RezerwacjePowiadomienia.jsonc | Rezerwacje 1:1 — przypomnienia | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (o pełnych kwadransach). Co 15 minut wysyła przypomnienia 24 h i 1 h przed spotkaniem. Liczone są od aktualnego terminu: po przeniesieniu stare wpisy są anulowane, a  | */15 * * * * | bookingPublic |
| RezerwacjeTick.jsonc | Rezerwacje 1:1 — święta i higiena danych | Raz dziennie: dopisuje polskie święta na 2 lata do przodu (odblokowane zostają odblokowane), czyści rejestr działań starszy niż 12 miesięcy i usuwa odpowiedzi z formularza 60 dni po rozmowie. Wywołanie potwierdza się tok | 15 3 * * * | bookingPublic |
| Rozgrzewanie.jsonc | Rozgrzewanie funkcji startowej | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (co 5 minut). Co 5 minut lekkie wywołanie funkcji startowej (bootstrap) i strony /dolacz, żeby goście nie trafiali na zimny start. | co 5 minutes | bootstrap, eventsPublic |
| RozgrzewanieSzczyt.jsonc | Rozgrzewanie /dolacz w dniu spotkania | 1 listopada 19:00–20:59 (czas polski): uruchamiane co 5 minut, w środku pinguje stronę /dolacz co minutę. | */5 19-20 1 11 * | eventsPublic |
| SpotkaniaTick.jsonc | Spotkania — przypomnienia i higiena danych | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (o pełnych kwadransach). Co 15 minut: przypomnienia 24 h / 1 h przed spotkaniami, podziękowania z nagraniem 12 h po oraz usuwanie zapisów 90 dni po wydarzeniu (tick w | co 15 minutes | eventsPublic |
| ZadaniaCykliczne.jsonc | Zadania cykliczne | Jeden przebieg co 5 minut (czas polski) obsługuje wszystkie zadania w tle: publikację zaplanowanych stron, wysyłkę i higienę biblioteki, rozgrzanie funkcji startowej i strony /dolacz, a o pełnych kwadransach (:00, :15, : | */5 * * * * | cronTick |
| ZmianaAdresuTick.jsonc | Zmiana adresu e-mail — ponawianie | WYŁĄCZONY — praca przeniesiona do „Zadania cykliczne” (o pełnych kwadransach). Co 15 minut: wykrywa przyjęte zaproszenia, ponawia nieudane przeniesienia, oznacza wygasłe linki. | */15 * * * * | emailChange |
