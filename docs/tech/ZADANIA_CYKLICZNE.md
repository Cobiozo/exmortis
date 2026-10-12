# Zadania cykliczne (workflows Base44)

> Plik generowany skryptem z kodu (docs/tech/generuj.mjs) — po zmianach uruchom ponownie: `node docs/tech/generuj.mjs`.

Pliki: `base44/workflows/*.jsonc`. Wywołują funkcje serwera z tokenem (`tick_token`) zapisanym w pliku — workflow Base44 nie czyta sekretów. Po migracji: zwykły cron (np. co 5/15 min) wołający te same adresy z tym samym tokenem.

| Plik | Nazwa | Co robi | Harmonogram | Funkcja |
|---|---|---|---|---|
| BibliotekaTick.jsonc | Biblioteka — wysyłka i higiena danych | Co 5 minut: wysyła wiadomości zaplanowane na teraz (atomowe przejęcie, najwyżej 20 na godzinę), wysyła zbiorcze powiadomienia o nowych materiałach i czyści historię zmian starszą niż 12 miesięcy. Wywołanie potwierdza się | */5 * * * * | libraryTick |
| CmsZaplanowane.jsonc | Strony — publikacje zaplanowane | Co 5 minut publikuje strony z edytora, których termin publikacji już minął. | */5 * * * * | cmsScheduled |
| DolaczSzczyt.jsonc | Rozgrzewanie strony dołączenia 1.11 | 1 listopada 19:00–20:59 (czas polski): uruchamiane co 5 minut, w środku pinguje stronę /dolacz co minutę. | */5 19-20 1 11 * | eventsPublic |
| RezerwacjePowiadomienia.jsonc | Rezerwacje 1:1 — przypomnienia | Co 15 minut wysyła przypomnienia 24 h i 1 h przed spotkaniem. Liczone są od aktualnego terminu: po przeniesieniu stare wpisy są anulowane, a spóźnione (powyżej 20 minut) nie wychodzą wcale. Wywołanie potwierdza się token | */15 * * * * | bookingPublic |
| RezerwacjeTick.jsonc | Rezerwacje 1:1 — święta i higiena danych | Raz dziennie: dopisuje polskie święta na 2 lata do przodu (odblokowane zostają odblokowane), czyści rejestr działań starszy niż 12 miesięcy i usuwa odpowiedzi z formularza 60 dni po rozmowie. Wywołanie potwierdza się tok | 15 3 * * * | bookingPublic |
| Rozgrzewanie.jsonc | Rozgrzewanie funkcji startowej | Co 5 minut lekkie wywołanie funkcji startowej (bootstrap) i strony /dolacz, żeby goście nie trafiali na zimny start. | co 5 minutes | bootstrap, eventsPublic |
| RozgrzewanieSzczyt.jsonc | Rozgrzewanie /dolacz w dniu spotkania | 1 listopada 19:00–20:59 (czas polski): uruchamiane co 5 minut, w środku pinguje stronę /dolacz co minutę. | */5 19-20 1 11 * | eventsPublic |
| SpotkaniaTick.jsonc | Spotkania — przypomnienia i higiena danych | Co 15 minut: przypomnienia 24 h / 1 h przed spotkaniami, podziękowania z nagraniem 12 h po oraz usuwanie zapisów 90 dni po wydarzeniu (tick w eventsPublic). | co 15 minutes | eventsPublic |
| ZmianaAdresuTick.jsonc | Zmiana adresu e-mail — ponawianie | Co 15 minut: wykrywa przyjęte zaproszenia, ponawia nieudane przeniesienia, oznacza wygasłe linki. | */15 * * * * | emailChange |
