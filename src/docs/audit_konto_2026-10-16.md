# Audyt QA — moduły konta (2026-10-16)

Trzecia runda audytu (po `audit_glos_podcast_2026-10-16.md` i `audit_obok_2026-10-16.md`). Zakres: strona /konto i wszystkie zakładki — produkty, spotkania (w tym bilety i nagrania), sesje 1:1, biblioteka, wiadomości, Obok, zakupy, ustawienia; poza zakresem: ROZDROŻA (osobny audyt).

## Naprawione

1. **Moje produkty / Zakupy bez obsługi błędu** — nieudane wczytanie zostawiało wieczne „Ładowanie…"; teraz komunikat i przycisk „Ponów" (jak w pozostałych modułach).
2. **Odliczanie dostępu na minusie** — kafelek produktu pokazywał „Dostęp kończy się za -3 dni", gdy data minęła, a rekord jeszcze nie odświeżył statusu; teraz pokazuje „Dostęp wygasł".
3. **Anulowanie spotkania przez systemowe okienko** — `window.confirm` w sesjach zamienione na potwierdzenie w miejscu (ANULOWAĆ? TAK / NIE), spójnie z resztą aplikacji.
4. **Zapis imienia bez obsługi błędu** — ustawienia konta czekały w nieskończoność przy nieudanym zapisie; teraz komunikat przy polu (role=alert).
5. **Pobieranie moich danych bez obsługi błędu** — nieudane przygotowanie pliku blokowało przycisk na zawsze; teraz komunikat i możliwość ponowienia.
6. **Blokada podwójnego anulowania** — po naprawie potwierdzenia przycisk anuluje tylko raz (busy).

## Zweryfikowane, bez zmian

- Strona konta: zakładki biblioteki, wiadomości i ROZDROŻA pokazują się tylko, gdy moduł jest dostępny (jedno lekkie wejście do funkcji, brak dodatkowych zapytań); link z dzwoneczka przełącza zakładkę; konto zablokowane dostaje ekran z wylogowaniem.
- Produkty: dostęp i pliki sprawdzane na serwerze (myAccount), PDF/audio przez podpisane linki, kurs przez osobny odtwarzacz; postęp lekcji i procent na kafelku; dostępny na zawsze / z datą.
- Sesje 1:1: bez dostępu — jasny ekran z drogami dalej (bez kalendarza); pakiety z limitem spotkań; przeniesienie i anulowanie z limitem czasowym sprawdzanym na serwerze; link Zoom 15 min przed.
- Spotkania: nagrania tylko w oknie udostępnienia (samoczynne zamknięcie odtwarzacza po czasie), odświeżanie podpisanych linków, znak wodny z e-mailem i kontrola integralności, blokada menu i pobierania; bilety z PDF i kodem; błędny adres logowania jasno komunikowany.
- Biblioteka i wiadomości: dane dochodzą razem z wejściem na konto (jedno wejście), szkielety ładowania, stany błędów, optymistyczne zaznaczanie „ukończone"/„przeczytane" z cichą naprawą przy braku sieci.
- Ustawienia: Listy (odczyt z ponowieniem, stan „czeka na potwierdzenie" z ponowną wysyłką), powiadomienia dzwonczka (optymistyczny przełącznik z cofnięciem przy błędzie), zgoda licencyjna przed pierwszym odtworzeniem kursu.
- Usuwanie konta: dialog z potwierdzeniem adresem e-mail, opis tego, co znika, wylogowanie po usunięciu — zgodne z funkcją mySettings.
- Nagrania i kurs: kontrola „jednego urządzenia" (stop po wykryciu drugiego), odświeżanie linku przed wygaśnięciem z zachowaniem pozycji, jedna próba naprawy przy błędzie pliku.

## Ostrzeżenia (bez zmian w kodzie)

- **Oceny produktów w Zakupach cicho rezygnują przy braku sieci** — przyciski ocen znikają zamiast pokazać komunikat; akceptowalne (element dodatkowy), ale do rozważenia.
- **Dzwoneczek powiadomień nie jest częścią tej rundy** — moduł powiadomień był już sprawdzony w poprzednich rundach; jeśli ma być pełny przebieg, osobna sesja.
- **Bilety i karty podarunkowe otwierają nowe okno** — na iOS z blokadą wyskakujących okien wymagają drugiego tapnięcia; systemowe zachowanie przeglądarki, nie usterka.