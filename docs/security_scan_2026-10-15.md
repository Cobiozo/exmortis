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

## 6. Przegląd zarzutów skanu platformy (2026-10-15, 19:40) — 14 funkcji publicznych
Skan platformy oznaczył je High „Anyone can run this function". Odczytane findings i fingerprinty zweryfikowano w kodzie — **żaden zarzut nie ujawnił luki**: każda funkcja ma limit na IP (baza albo licznik w pamięci), dane osobowe i ceny pochodzą z bazy, treści maili są stałe (esc w polach), akcje zarządzania chronione tokenem/adminem. Wymóg logowania celowo NIE został dodany (goście: zapisy, kasa, formularze). Nie zmieniono żadnej z 14 funkcji.

| funkcja | zarzut ze skanu (1 zdanie) | zabezpieczenie w kodzie (zweryfikowane) | poprawiono | fingerprint (pełny) |
|---|---|---|---|---|
| bookingPublic | book/book_package tworzą rezerwacje i wysyłają potwierdzenia bez logowania. | Limit bk_rate_hit w bazie: 5/IP/10 min + 3/e-mail/h (HMAC IP i e-maila); zarządzanie/anulowanie/tick po tokenie lub adminie. | Nie | 2fab45565081eac946e707dd27c671232fddba5f4f616760f8f8c59d0908dfc9 |
| clientError | Publiczny zapis błędów przeglądarki bez logowania. | Limit 10/h na IP liczony w encji ClientError; RLS blokuje bezpośredni zapis SDK. | Nie | d0e43cf5d92e141764850d6f1c60c81f29ff9acb92cc9e8216e3f48e853e304b |
| createContactMessage | Formularz kontaktowy zapisuje wiadomość, przy kryzysie mail do admina, bez logowania. | Limit 5/h na IP + pole-pułapka (body.website → fałszywy sukces); treść maila stała, pola escapowane. | Nie | 040cf8dedf680fc8df308d6279be7860a53128a1f53fb3bdb70c838a4c9a7f57 |
| createPodcastApplication | Zgłoszenie podcastu zapisuje rekord i wysyła 1–2 maile bez logowania. | Limit 3/h na IP, walidacja e-maila; treść maila stała (bez treści zgłoszenia). | Nie | 492361bf8ee8a88458546f457f0f5b49129cc5182d37096d0357aba30534fdac |
| createPowrotApplication | Zgłoszenie kwalifikacyjne zapisuje rekord, przy kryzysie mail, bez logowania. | Limit 5/h na IP; dane przez esc/escStr; treść maila stała. | Nie | 5d99ba7cba261051fb8555813b75f7dea2120cf5b53691d7121eae185c69b35b |
| eventsPublic | register/remind zapisują i wysyłają maile bez logowania, tick usuwa dane (retencja) bez autoryzacji. | register 8/h, remind 5/h na IP; tick blokada 1/min w bazie i praca idempotentna (claim FOR UPDATE SKIP LOCKED); flush tylko admin. | Nie | ba1f25a5b04e7d9ec4fd68ebdf9826ee52678b02fef718caa7e9cf0f275500eb |
| instagramFeed | Publiczny endpoint używa tokena aplikacji do Instagram Graph API bez logowania. | Cache 10 min + limit 60/min na IP; token tylko po stronie serwera (nigdy w odpowiedzi). | Nie | 9dac34252ada57d20cc8e3879602089fbfd65b85a9865c456564939337faadef |
| orderFree | Darmowe zamówienie tworzy zamówienie, dostęp i mail z linkiem bez logowania. | Tylko produkty is_free=true (sprawdzone w SQL); limit 5/h na IP i produkt; treść maila stała. | Nie | 83057afbac4a1a9b3120a9389dafb521c0c22d5b607b21913ba0c035be41c33c |
| payuCreateOrder | Kasa wywołuje API PayU i zapisuje zamówienia bez logowania. | Limit 20/h na IP; ceny, promocje i kroki cenowe z bazy (nigdy z przeglądarki); płatność chroniona przez PayU. | Nie | 48c76bafb121f46221ac522d56fdc00fc367fb883d9413569f447767f72a85b8 |
| shopQuizSubmit | Test zapisuje wynik i wysyła mail bez logowania. | Limit 10/h na IP; odpowiedzi walidowane (12/15 pól, wartości 0–3), otwarta odpowiedź max 2000 znaków; wynik liczony na serwerze. | Nie | 5d1601836e2011f20dcb9c7389fc5fe18189a0239f231451db61e99ca18d0217 |
| shopWaitlist | Zapis na listę oczekujących pisze do bazy bez logowania. | Limit 10/h na IP i produkt; walidacja e-maila (emailField). | Nie | 55f5b8493528ec8bb24b16e68aa24c369f59c2d04faebc5099514a9ef7ccb876 |
| silenceSession | Anonimowe statystyki sesji ciszy zapisywane bez logowania. | Limit 60/h na IP (licznik w pamięci); bez maili i danych osobowych; skan sam ocenia wagę niską. | Nie | 23362d42e0ecd65fca0ccaf4eff80acfca8775c37ed0134ac60328e13ca2321e |
| subscribeNewsletter | Zapis na newsletter dopisuje subskrybenta i wysyła potwierdzenie bez logowania. | Limit 5/h na IP; double opt-in; confirm/unsub/drip_stop po tokenach z bazy. | Nie | 5d11eb3a0d009491aedc28637fc27e04b9e203e14722a2a0449fda6c6785315d |
| withdrawal | Zgłoszenie odstąpienia zapisuje rekord i wysyła 2 maile bez logowania. | Limit 5/h na IP (w SecurityLog); treść maili stała z esc polami; wysyłka bramkowana w smtp. | Nie | a5fd4d09271332db81da7176b96b099208c10e22aac32afa0999574a25df1800 |

Uwaga do fingerprintów: odpowiedź skanu ucięła sekcję `open_backend_functions` na literze „n" — dla 7 funkcji fingerprint pochodzi z sekcji findings tego samego skanu (ten sam skan, pełny 64-znakowy hash). Brak realnych luk → bez poprawek kodu.

## 7. Pozostałe znaleziska skanu
- **FAKTUROWNIA_API_TOKEN (krytyczne)** — nazwa sekretu odczytywanego w `invoices.ts` nie jest zarejestrowana. Deklaracja nazwy została zaproponowana i **pominięta przez użytkownika** — automatyzacja faktur pozostaje nieaktywna, dopóki token nie zostanie dodany w panelu (Sekrety). Kod nie zmieniony.
- RLS: brak rekomendacji. Nagłówki: poza zakresem (platforma nie pozwala ich nadpisać — patrz skan z 2026-10-14).

## Wynik
Bez znalezionych podatności w tym zakresie. Wprowadzone zmiany wydajnościowe (leniwe strony, kolejność preloadu) są neutralne dla bezpieczeństwa.