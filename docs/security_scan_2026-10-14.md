# Skan — 2026-10-14 · moduł rezerwacji 1:1 (POWRÓT)

Zakres: funkcje `bookingPublic`, `bookingAdmin`, moduły `shared/booking*.ts`, panel i strony rezerwacji.
Metoda: przegląd kodu, zapytania tylko do odczytu do bazy, build produkcyjny, próbne wywołanie zadania cyklicznego.

## Stan faktyczny (odczyt z bazy)
- Moduł rezerwacji: `bk_settings.mode = 'on'` (włączony dla klientów).
- Token zadań `bk_settings.tick_token` **zgadza się** z wartością wpisaną w `RezerwacjeTick` i `RezerwacjePowiadomienia` — przypomnienia i higiena danych faktycznie się wykonują.
- Token zadań `mb_settings.tick_token` zgadza się z `CmsZaplanowane` i `BibliotekaTick`.
- Tabele `bk_bookings`, `bk_packages`, `bk_notifications`, `bk_gcal_queue` są puste (brak ruchu) — brak błędów danych do naprawy.
- Workflow „Rezerwacje 1:1 — przypomnienia" aktywny, uruchomienia co 15 min kończą się statusem `ok`.

## Poprawione
1. **Przypomnienia — wydajność (`shared/bookingNotify.ts`).** Zapytanie o zaległe przypomnienia zwraca już wszystkie pola treści i pliku .ics, więc zniknął osobny odczyt bazy na każdą wiadomość (wcześniej do 40 rund na jedno uruchomienie). Adres nadawcy pobierany raz na partię, a zapytanie idzie kanałem tylko do odczytu.
2. **Panel — kalendarz dnia (`BookingCalendar.jsx`).** Okno dnia startowało w godzinie otwarcia panelu, przez co poranne terminy (przed tą godziną) wypadały z widoku. Teraz liczone jest od początku polskiej doby, z poprawnym przejściem przez zmianę czasu.
3. **Panel — czytelność odpowiedzi (`bookingAdmin` + `BookingsList.jsx`).** Odpowiedzi z formularza pokazywały się pod kluczami `q1`, `q2`. Teraz panel dociąga pytania rodzaju spotkania i pokazuje pełną treść pytania (także pytania o zdrowie).
4. **Panel — potwierdzenie wysyłki (`BookingCalendar.jsx`).** Przycisk „Wyślij potwierdzenie" nie dawał żadnego sygnału po sukcesie; teraz pokazuje komunikat.

## Zweryfikowane jako poprawne
- **Autoryzacja `bookingAdmin`**: każda akcja pod `requireAdmin` (rola `admin`).
- **Zadania cykliczne**: `tick`/`notify_tick` wymagają administratora albo tokenu z `bk_settings`, porównywanego w czasie stałym (SHA-256 + XOR); brak tokenu = 403.
- **Dane o zdrowiu**: szyfrowane AES-256-GCM po stronie funkcji serwera; do bazy trafia wyłącznie szyfrogram. Odszyfrowanie tylko w `bookingAdmin` (zapis w rejestrze odczytu). Retencja 60 dni liczona od końca spotkania.
- **Izolacja danych**: wszystkie tabele `bk_*` mają RLS i odebrane uprawnienia dla `anon`/`authenticated`; funkcje `bk_*` dostępne wyłącznie dla `service_role`.
- **Tokeny**: linki do zarządzania i do pakietu są jednorazowe/losowe, w bazie tylko skrót SHA-256; token we fragmencie adresu (nie trafia do logów ani Referer), strona ustawia `referrer: no-referrer`.
- **Limit prób**: `bk_rate_hit` (5 na IP / 10 min, 3 na e-mail / godzinę); klucze to HMAC liczone na serwerze — do bazy nie trafia adres IP ani e-mail jawny.
- **Rezerwacja atomowa**: blokada doradcza + ograniczenie wykluczające (`btree_gist`) na zakresie `busy`; podwójna rezerwacja tego samego terminu niemożliwa.
- **Kalendarz Google**: wyłącznie zakresy `calendar.app.created` i `calendar.freebusy`; zapis tylko do własnego kalendarza, z głównego czytana tylko zajętość; błąd Google nigdy nie przewraca rezerwacji (kolejka ponowień).
- **Eksport CSV**: neutralizacja komórek zaczynających się jak formuła.

## Funkcje publiczne — przegląd (2026-10-14)

Sprawdzono wszystkie funkcje pod kątem tego, co da się wywołać bez logowania.

### Bez zastrzeżeń
- **bootstrap / siteSettings / siteContent** — zwracają wyłącznie dane publiczne. `publicSettings` przepuszcza tylko pola firmy z listy dozwolonej (`cleanFirma`), a ustawienia przedpremierowe bez listy dostępu (pole `dostep` odcinane przed odpowiedzią). Klucze `payu` i `smtp` (z hasłami) nie są czytane tą ścieżką — `getSettingsFast` pobiera wyłącznie wskazane klucze. Odpowiedzi trzymane dodatkowo w kopii w pamięci instancji.
- **media** — proxy obrazów z biblioteki: wymaga nagłówka pochodzenia z dozwolonej domeny, `pub_id` jest losowy (32 znaki), limit 300 żądań na minutę, link do pliku podpisywany na 60 s.
- **payuNotification** — autentyczność potwierdzana podpisem OpenPayU na surowej treści żądania; bez poprawnego podpisu odrzuca.
- **eventsCancel** — token 32 znaki; zapis z opłaconym biletem nie jest zwalniany jednym kliknięciem.
- **orderFree / shopQuizSubmit / webinarSignup / subscribeNewsletter / shopWaitlist / createPowrotApplication / createContactMessage / withdrawal / checkDiscount** — każdy ma limit na IP (5–10 na godzinę) przed wysyłką e-maila; `checkDiscount` i `withdrawal` zapisują próby w rejestrze bezpieczeństwa, a `createContactMessage` ma pole-pułapkę na boty.
- **Funkcje konta** (`myAccount`, `library`, `obok`, `course`, `notifications`, `myEvents`, `tickets`, `announcements`, `gdprPerson`) — każda wiąże dane z adresem zalogowanego użytkownika, nigdy z identyfikatorem podanym w żądaniu. `gdprPerson`, edycja w `announcements` i wszystkie `admin*` wymagają roli `admin`. Nie znaleziono możliwości podejrzenia cudzych danych przez podstawienie identyfikatora.
- **silenceSession** — anonimowe statystyki, limit 60 zdarzeń na godzinę, bez danych osobowych.
- **Zapytania SQL** — wszystkie wartości przechodzą przez quoting (`escStr`) lub parametry; brak sklejania danych od użytkownika z treścią zapytania.

### Poprawione
1. **instagramFeed** — publiczny adres wywoływał Instagram Graph API przy każdym wejściu na stronę główną. Dodano pamięć 10 minut w instancji (jedno wywołanie obsługuje wszystkich gości) i limit 60 żądań na minutę.
2. **giftCardView** — dodano limit 30 odczytów na godzinę z jednego połączenia (klucz karty pozostaje losowy i nieodgadywalny).
3. **payuNotification** — porównanie podpisu w czasie stałym (odporność na atak czasowy).
4. **media** — mapa liczników czyszczona po przekroczeniu rozmiaru (brak nieograniczonego wzrostu pamięci instancji).

## Ryzyka otwarte (bez zmian)
1. Wylogowanie ze wszystkich urządzeń — ograniczenie platformy.
2. Podpisane linki do plików działają do 1 godziny.
3. Klucz `service_role` Supabase trzymany w pamięci instancji (1 h), nigdy w logach ani odpowiedzi.
4. Poczta: do czasu konfiguracji SMTP przypomnienia czekają w kolejce (bez utraty danych).
5. Limity publicznych formularzy działają per IP; przy braku nagłówka adresu (rzadkie) przepuszczają — świadomy wybór, żeby formularz nigdy nie zniknął przez licznik.