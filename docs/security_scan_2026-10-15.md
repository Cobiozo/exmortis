# Skan — 2026-10-15 · autoryzacja, izolacja danych, wstrzykiwanie, manipulacja stanem

Zakres: pełny przegląd reguł RLS wszystkich encji, funkcji serwerowych (tożsamość, walidacja), SQL pod kątem wstrzykiwania, ścieżek zapisu dostępnych klientowi. Kontekst: publikacja z leniwym ładowaniem stron (`/login`, `/register`, `/kontakt`, `…/dolacz` — osobne paczki) i przeniesionym preloadem hero. Zmiany te nie dotykają warstwy uprawnień — każdy nowy plik jest chroniony tymi samymi regułami routingu i funkcji co wcześniej.

Test PageSpeed (mobile, 2026-10-15): **Performance 99**, FCP 0,9 s, LCP 1,8 s, TBT 0 ms, CLS 0,036 (wcześniej: 74 / FCP 3,3 s / LCP 4,7 s / TBT 2070 ms).

## 1. Reguły dostępu (RLS) — wszystkie encje (59)
- **Bez RLS:** wyłącznie `User` — encja wbudowana platformy (odczyt cudzych kont tylko dla administratora, bez tworzenia/usuwania). Pozostawiamy bez własnych reguł (platforma pilnuje tego sama).
- **Odczyt publiczny (treści, bez danych osobowych):** `PublishedPage`, `SiteNav`, `PodcastSettings`, `SilenceSettings`, `Utwor`, `LegalDocVersion`, `PageRedirect`. Zapis w każdej z nich wyłącznie `admin`/`techniczna`.
- **Wszystko pozostałe:** odczyt `admin` albo właściciel (`{{user.email}}`), zapis/usuwanie wyłącznie serwer (rola `admin` w RLS — klient nie zapisze ani nie skasuje niczego bezpośrednio z przeglądarki).
- Izolacja X↔Y: `Access` i `LessonProgress` czytelne tylko dla właściciela lub administratora; funkcje konta (`course`, `myAccount`, `library`, `obok`, `myEvents`, `notifications`) biorą adres **wyłącznie z zalogowanej sesji** (sprawdzone w kodzie: `me.email`, a identyfikator z żądania jest tylko porównywany z sesją — podstawienie cudzego `access_id` kończy się odmową).

## 2. Wstrzykiwanie SQL — skan automatyczny
448 szablonów SQL w `shared/` i `functions/` przeanalizowanych pod kątem interpolacji bez escapowania:
- **Nie znaleziono podatności.** Wszystkie dane od użytkownika idą przez `escStr`/`esc` (dollar-quoting z unikalnym ogranicznikiem) albo silne rzutowanie na liczbę (`Number(x) || n`).
- Nazwy tabel/kolumn interpolowane wyłącznie ze stałych w kodzie (`SUPABASE_TABLES`, `PUB_COLS`, `SB`, `claim()` z literalami) — nigdy z wejścia.
- Publiczne funkcje (`eventsPublic`, `bookingPublic`, `media`, `silenceSession`, `createContactMessage`, `createPowrotApplication`) sprawdzone szczegółowo — czysto.

## 3. Manipulacja stanem po stronie klienta
- **Ceny, rabaty, karty, bilety, limity miejsc** — liczone wyłącznie na serwerze z bazy (koszyk jest tylko wskazówką); podmiana stanu w przeglądarce nic nie daje (zweryfikowane 2026-10-14, bez zmian).
- **Postęp lekcji** — zapis tylko przez funkcję serwerową, dla adresu z sesji i lekcji z opłaconego produktu.
- **ROZDROŻA** — stan gry po stronie przeglądarki (bez waluty); treści (`RozdrozaStory`/`Scene`/`Choice`) tylko do odczytu administratora, serwisowane przez funkcję.
- **Konta** — statusu roli nie da się ustawić z zewnątrz (User tylko do odczytu klienta); blokada `zablokowane` egzekwowana w każdej funkcji konta (403).
- **Status zamówienia nie wychodzi z przeglądarki** — klient odpytuje po losowym numerze, bez danych osobowych.
- Otwarte ryzyko bez zmian: wyścig `max_uses` kodu jednorazowego (kilka równoległych zamówień) — udokumentowane, wymaga atomowego licznika w Supabase; bez realnego ruchu odroczone.

## 4. Autentykacja i sesje
- Logowanie/rejestracja/reset — powierzchnia platformy (token w przeglądarce, e-mail/OTP, podpisywane linki); nie przerabialiśmy nic w tych przepływach, leniwe ładowanie nie zmienia kontroli dostępu.
- „Wylogowanie ze wszystkich urządzeń" — nadal ograniczenie platformy (bez zmian).
- Panel `/admin` — za logowaniem, każda akcja `admin*` ponownie sprawdza rolę na serwerze (warstwa widoku to za mało — tak jest i tak jest wdrożone).

## 5. Endpoint protection (publiczne funkcje)
Zweryfikowane jako poprawne (kontynuacja skanu 2026-10-14): limity na IP przed wysyłką maili, pole-pułapka na boty w formularzu kontaktu, tokeny zadań porównywane w czasie stałym, podpis OpenPayU na `payuNotification`, PDF biletu i karta podarunkowa po losowym kluczu z limitami, `media` z ograniczeniem pochodzenia żądania.

## Wynik
Bez znalezionych podatności w tym zakresie. Wprowadzone zmiany wydajnościowe (leniwe strony, kolejność preloadu) są neutralne dla bezpieczeństwa.