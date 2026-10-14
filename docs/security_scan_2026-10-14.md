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

## Panel administratora i funkcje `admin*` — przegląd (2026-10-14)

Model ról: **admin** (wszystko) i **techniczna** (treści, menu, ustawienia, integracje, cisza — bez danych osobowych i bez sekretów).

### Znalezione i naprawione (uprawnienia)
- **`adminSettings` — klucze płatności i poczty były zapisywalne przez rolę „techniczna".** Akcje `save` i `delete` dla `payu` i `smtp` nie sprawdzały roli, więc użytkownik techniczny mógł podmienić dane merchantu PayU (POS ID, Client ID, Client Secret, drugi klucz) na własne konto — co przekierowałoby wszystkie płatności — albo wskazać własny serwer SMTP i przejąć całą wychodzącą pocztę (łącznie z linkami do resetu hasła). Odczyt był maskowany, ale zapis nie. Teraz `save`/`delete` dla `payu` i `smtp` wymagają roli `admin` (spójnie z akcjami `video_*`, które już tak działały).
- **`mailAdmin` — ta sama dźwignia drugą drogą.** `save` (zapis hasła SMTP) i `test` (wysyłka na dowolny adres z serwera aplikacji) były dostępne dla całego personelu. Teraz wymagają roli `admin`; `status`, `dns` i `log` (adresy maskowane) zostają dostępne dla personelu.
- **`IntegrationsManager` (sekcja „Integracje")** — formularz kluczy PayU pokazywał się roli technicznej. Teraz widzi go wyłącznie administrator.

### Zweryfikowane jako poprawne
- **Wejście do panelu**: `/admin` stoi za logowaniem, a sam panel sprawdza rolę i przy roli „techniczna" dopuszcza wyłącznie sekcje `tresci`, `menu`, `ustawienia`, `integracje`, `cisza`. To jednak tylko warstwa widoku — każde wywołanie funkcji jest sprawdzane osobno po stronie serwera, więc obejście adresu nic nie daje.
- **Funkcje z danymi osobowymi**: `adminClients` (klienci, dostępy, blokady), `adminOrders`, `adminNewsletter`, `adminSubscribers`, `adminQuiz`, `adminProducts`, `adminDashboard`, `emailChange`, `gdprPerson` — wszystkie wymagają roli `admin`, a `adminClients` zwraca 403, gdy sprawdzenie się nie powiedzie.
- **Moduły**: `bookingAdmin`, `libraryAdmin`, `eventsAdmin`, `rozdrozaAdmin`, `ticketsAdmin` — rola `admin`.
- **`adminContent`** i **`silenceAdmin`** — celowo dla całego personelu (treści i ustawienia modułu Cisza, bez danych osobowych). Zapis treści przechodzi walidację klucza (`^[a-z0-9._-]+$`) i limitu rozmiaru bloku; wartości idą przez quoting SQL.
- **Maskowanie**: `adminSettings.get` zwraca `clientSecret`, `secondKey` i hasło SMTP jako maskę; `mailAdmin.status` maskuje hasło, a `log` skraca adresy odbiorców do `xx***@domena`.
- **Rola „techniczna" nie widzi** listy adresów z dostępem przedpremierowym (pole `dostep` odcinane przed odpowiedzią) ani sekretów integracji.

### Uwaga do sprzątnięcia (bez wpływu na bezpieczeństwo)
`IntegrationsManager` ma martwy fragment kodu: `sendTest` wywołuje funkcję `smtpTest`, której nie ma (przycisk testu przeniesiono do `MailSettings` → `mailAdmin`). Kod jest nieosiągalny z interfejsu — do usunięcia przy okazji.

## Zakup, płatność i realizacja zamówień — przegląd (2026-10-14)

Zakres: `payuCreateOrder`, `payuNotification`, `orderFree`, `shared/orders.ts`, `fulfillOrder.ts`, `discounts.ts`, `giftCard.ts`, `tickets.ts`, `access.ts`, `productPrice.ts`, `invoice.ts`, `functions/tickets`.

### Znalezione i naprawione
1. **Cudza karta podarunkowa do wypalenia z pola „uwagi".** Po opłaceniu `fulfillOrder` odczytywał użyty kod rabatowy z **notatki zamówienia** (`note`), a notatka zawiera tekst wpisany przez kupującego. Wystarczyło w polu uwag wpisać `Kod rabatowy: PREZENT-XXXXXXXX (−1 zł)`: przy zamówieniu **bez** realnego rabatu to ta linia była ostatnia w notatce, więc serwer zwiększał licznik użyć wskazanego kodu. Kod jednorazowy (karta podarunkowa) stawał się przez to bezużyteczny dla właściciela — bez zakupu i bez wiedzy obsługi. Teraz kod jest zapisywany wprost w kolumnie `discount_code` zamówienia i stamtąd czytany (ten sam wzorzec, co przy kolumnie `invoice`); notatka pozostaje wyłącznie informacją dla panelu i nie jest już nigdy parsowana. Kolumna dodana w bazie.

### Zweryfikowane jako poprawne
- **Ceny po stronie serwera**: kwoty, pozycje i rabat liczone z bazy — dane z koszyka nie są brane za pewnik. Produkty nieaktywne, „wkrótce", „ukryty" i darmowe nie przechodzą przez kasę; kwota karty podarunkowej musi być jedną z kwot zdefiniowanych w produkcie.
- **Kody rabatowe**: nie obniżają ceny karty podarunkowej i nie łączą się z nią; karta nie może opłacić innej karty; zakres produktowy kodu jest respektowany.
- **Karty podarunkowe**: kod `PREZENT-` + 10 znaków z 32-znakowego alfabetu (≈10^15 kombinacji), jednorazowy (`max_uses: 1`), ważny 6 miesięcy; powstają idempotentnie po numerze zamówienia, a dane na karcie są oczyszczane i escapowane.
- **`payuNotification`**: autentyczność podpisem OpenPayU, atomowe przejęcie pierwszego `COMPLETED`, ponowienia nie dublują dostępu, kart ani biletów (idempotencja po numerze zamówienia i numerze pozycji), a nieudana realizacja cofa przejęcie, żeby PayU ponowił powiadomienie.
- **Bilety**: cena, liczba miejsc i termin sprzedaży z serwera; zajętość = ważne bilety + niedokończone płatności z ostatnich 30 minut; numery losowane z ponowieniem przy kolizji; wejście to jedno atomowe przejście „ważny → wykorzystany"; cofnięcie i statystyki wyłącznie dla administratora albo osoby z nadanym uprawnieniem (także ograniczonym do jednego wydarzenia i do daty); PDF i podgląd biletu dostępne tylko po losowym kluczu, z nagłówkiem `no-store` i `noindex`.
- **`orderFree`**: tylko produkt oznaczony jako darmowy, limit 5 wysyłek na godzinę na IP i materiał, treść maila escapowana.
- **Maile**: nazwy produktów, imiona, adresy i dane do faktury escapowane (`escHtml`); pełny numer zamówienia w mailu, w panelu skrócony.
- **Faktura**: NIP sprawdzany z sumą kontrolną, nazwa i adres z limitem długości.
- **`libraryTick`**: wywołanie tylko przez administratora albo token zadania porównywany w czasie stałym; limit 20 wysłanych wiadomości na godzinę.
- **`tickets` — mapa limitów skanera** czyszczona przy wielu różnych skanerach (brak nieograniczonego wzrostu pamięci instancji).

## Biblioteka i wiadomości do klientów — przegląd (2026-10-14)

Zakres: `library`, `libraryAdmin`, `libraryTick`, moduły `shared/library*.ts`, strony konta (`MyLibrary`, `MyMessages`, odtwarzacze, okno materiału) i panel (`LibraryPanel`, `MaterialsTab`, `MessagesPanel`, `MessageForm`, `MessageRow`, `AssignDialog`, `TargetPicker`).

### Znalezione i naprawione
1. **Szkic wiadomości do ponad 10 osób nie dawał się wysłać z listy.** Serwer słusznie wymaga potwierdzenia przy takiej wysyłce, ale przycisk „Wyślij teraz" w wierszu listy nie miał żadnej ścieżki potwierdzenia — pokazywał tylko komunikat „Potwierdź wysyłkę do ponad 10 osób" i nic więcej. Formularz nowej wiadomości miał okno potwierdzenia, lista nie. Dodano okno potwierdzenia z liczbą odbiorców (ten sam próg co przy nowej wiadomości).
2. **Wysyłka masowa szła po jednej wiadomości.** Przy włączonej poczcie to do 500 kolejnych wysyłek jedna po drugiej — kilkanaście minut, po których zadanie jest przerywane w połowie, a wiadomość i tak jest już oznaczona jako wysłana. Teraz wiadomości lecą partiami po 6.
3. **Zbiorcze powiadomienia o nowych materiałach — ta sama wada.** Jeden e-mail na osobę w pętli; teraz partiami po 6.
4. **Przydział kolekcji wielu osobom: jedno zapytanie do bazy na osobę** (do 500 pod rząd). Teraz partiami po 8, a daty widoczności liczone raz zamiast przy każdej osobie.
5. **Plakietka „Nowe" nie znikała po otwarciu materiału.** Znikała dopiero po oznaczeniu materiału jako ukończony albo po przeładowaniu strony, bo odświeżenie stanu było podpięte pod przycisk „Ukończone", a nie pod otwarcie. Teraz znika w chwili otwarcia.
6. **Pole „Notatka dla osoby" przy przydziale było niekontrolowane** (puste na starcie, bez wartości początkowej) — React zgłaszał ostrzeżenie, a pole zachowywało się jak niekontrolowane. Ustawiona wartość początkowa.

### Zweryfikowane jako poprawne
- **Tożsamość wyłącznie z sesji.** Strona klienta nigdy nie przyjmuje adresu e-mail z żądania — bierze go z zalogowanego konta. Podstawienie cudzego adresu jest niemożliwe.
- **Dostęp do materiału sprawdzany przy każdej operacji.** Otwarcie i oznaczenie jako ukończone przechodzą przez regułę widoczności w bazie (`mb_visible_materials`); brak wiersza = odmowa bez ujawniania, czy materiał istnieje.
- **Klucz pliku nie opuszcza serwera.** Do przeglądarki trafia wyłącznie link podpisany na 10 minut (PDF) albo 60 minut (audio, wideo), odnawiany w tle przed wygaśnięciem i po błędzie odtwarzania, z zachowaniem miejsca odtwarzania.
- **Adresy wideo z własnego serwera** sprawdzane ponownie przy każdym wydaniu — usunięcie domeny z ustawień zamyka dostęp natychmiast.
- **Treść czyszczona dwa razy:** przy zapisie i przy wyświetleniu (biała lista znaczników, linki tylko `https:` i `mailto:`, encje rozkodowywane przed sprawdzeniem schematu).
- **Wiadomości:** cudza wiadomość = brak wiersza odbiorcy = odmowa; oznaczenie jako przeczytane i ukrycie nie ujawniają, czy wiadomość istnieje.
- **Panel wyłącznie dla roli „admin"** (`requireAdmin` na wejściu każdej akcji), nieznana akcja = 404, komunikat błędu nie zdradza szczegółów.
- **Token zadania** porównywany w czasie stałym; limit 20 wysłanych wiadomości na godzinę obowiązuje i w zadaniu, i w panelu.
- **Historia zmian:** adresy maskowane (`da***@domena`), bez treści wiadomości.
- **Pliki:** sprawdzane rozszerzenie, sygnatura i rozmiar (limit 10 MB PDF, 100 MB audio i wideo); PDF z aktywną treścią dostaje ostrzeżenie, nie blokadę.
- **Baza:** wszystkie tabele `mb_*` mają włączony RLS i nie mają żadnych uprawnień dla `anon`/`authenticated`; żadna funkcja `mb_*` ani `bk_*` nie jest wykonywalna przez role publiczne (sprawdzone w katalogu bazy).

## Skarbiec i zamówienia — przegląd (2026-10-14)

Zakres: kasa (`Checkout`), `payuCreateOrder`, `payuNotification`, `orderFree`, `checkDiscount`, `adminOrders`, `shopProducts`, `giftCardView`, moduły `shared/orders.ts`, `shared/fulfillOrder.ts`, `shared/discounts.ts`, `shared/giftCard.ts`, `shared/access.ts`, `shared/productPrice.ts`, panel Zamówień i Statystyk sprzedaży.

### Znalezione i naprawione
1. **Statystyki sprzedaży czytały kody rabatowe z notatki zamówienia.** Notatkę wpisuje kupujący, a to właśnie z niej liczony był raport „Kody rabatowe" w panelu. Wystarczyło wpisać w notatkę tekst „Kod rabatowy: COKOLWIEK (−999,99 zł)", żeby na liście pojawił się wymyślony kod z wymyśloną kwotą — a ponieważ odczyt brał pierwsze trafienie od początku, sfałszowany wpis przesłaniał prawdziwy kod. To ta sama pułapka, którą zamknięto wcześniej przy realizacji zamówienia; statystyki zostały wtedy z tyłu. Teraz kod pochodzi z kolumny zamówienia, a kwota rabatu jest liczona z pozycji i kwoty faktycznie zapłaconej (suma pozycji minus zapłata) — nie da się jej podrobić tekstem. Dwa historyczne zamówienia sprzed wprowadzenia tej kolumny uzupełnione jednorazowo, żeby raport się nie urwał.
2. **Kasa nie miała żadnego limitu.** To publiczny adres bez logowania, a każde złożone zamówienie to dwa zapytania do PayU i wpis w bazie. Dodany limit 20 zamówień na godzinę z jednego połączenia. Sprawdzanie stanu zamówienia po powrocie z PayU celowo limit nie obejmuje — inaczej strona powrotu psułaby się po kilku odświeżeniach.
3. **Karty podarunkowe nie dopełniały się po przerwanym wystawianiu.** Komplet rozpoznawany był po tym, czy istnieje choć jedna karta z danym numerem zamówienia — gdy realizacja przerwała się w połowie, powtórka nie dokładała brakujących kart i kupujący, który zapłacił za trzy, zostawał z jedną, bez maila. Teraz liczba rozpoznawana jest per pozycja (kwota + dedykacja): powtórka dokłada dokładnie brakujące karty, a już wydanych nie dubluje. Cały komplet trzyma jedną datę ważności, więc powtórka jej nie przesuwa. Drugi brakujący element: błąd przy wystawianiu kart był połykany, zamówienie i tak oznaczane jako zrealizowane i **żadna powtórka nie następowała** — teraz nieudane wystawienie przerywa realizację (przejęcie zamówienia cofnięte), więc PayU ponowi powiadomienie i komplet się dopełni.

### Zweryfikowane jako poprawne
- **Ceny liczone wyłącznie na serwerze.** Dane z koszyka są tylko wskazówką, który produkt i ile sztuk; kwota, promocja i próg drabinki biorą się z bazy. Podmiana ceny w przeglądarce nic nie daje.
- **Produkty ukryte, darmowe i „wkrótce" nie przechodzą przez kasę** — sprawdzane przy każdym zamówieniu, nie tylko na liście.
- **Karty podarunkowe:** kwota wyłącznie z listy kwot ustawionej w produkcie; kod z karty nie obniża ceny innej karty, a zwykły kod rabatowy nie obniża ceny karty (karta ma wartość równą zapłaconej kwocie).
- **Powiadomienie z PayU:** podpis weryfikowany kluczem drugim, porównanie w czasie stałym; bez poprawnego podpisu żądanie jest odrzucane.
- **Płatność nie może zostać zaliczona dwa razy.** Pierwsze potwierdzenie z PayU przejmuje zamówienie atomowo — powtórzone i równoległe powiadomienia nie dublują dostępu, maili ani kart. Gdy realizacja się nie uda, przejęcie jest cofane, żeby PayU ponowiło.
- **Statusu zamówienia nie da się ustawić z przeglądarki** — klient może tylko odpytać o stan po losowym numerze zamówienia, i to bez żadnych danych osobowych.
- **Koszyk czyści się dopiero po potwierdzeniu płatności**, nie po kliknięciu „Zamawiam".
- **Kod rabatowy liczy się jako użyty dopiero po opłaceniu**, a limit użyć jest sprawdzany przy składaniu zamówienia.
- **Dostęp nadawany po zakupie nigdy nie skraca** już posiadanego, a to samo zamówienie nie wydłuża go drugi raz.
- **Panel zamówień tylko dla administratora**; wyszukiwarka oczyszcza znaki specjalne, a eksport CSV nie pozwala wstawić formuły do arkusza.
- **Karta podarunkowa z linku:** klucz 32 losowe znaki, 30 odczytów na godzinę z jednego połączenia, zwracana wyłącznie treść karty.
- **Baza:** wszystkie tabele publiczne mają włączony RLS, brak jakichkolwiek uprawnień dla `anon`/`authenticated`, żadna funkcja nie jest wykonywalna publicznie (sprawdzone w katalogu bazy).

## Kody rabatowe i karty podarunkowe — przegląd (2026-10-14)

### Znalezione i naprawione
1. **Aktywny kod „TEST" dawał nieograniczony rabat 197 zł.** W bazie leżał kod `TEST` (rodzaj: kwota, 197 zł, **bez limitu użyć**, ważny do 2027-04-13) — pozostałość po testowaniu karty podarunkowej, z opisem „Karta podarunkowa · testowa". Wystarczyło wpisać w kasie słowo „TEST", żeby dostać 197 zł zniżki na dowolne zamówienie i to bez ograniczenia liczby razy. Kod wyłączony (`active: false`); rekord zostaje, więc do testów można go włączyć jednym kliknięciem.
2. **Stara karta podarunkowa bez klucza do wydruku.** Karta z zamówienia 56E8771A nie miała wygenerowanego klucza linku (`gift_token`), więc nie dało się otworzyć jej wersji do wydruku — ani z maila, ani z konta. Klucz uzupełniony (32 znaki). Ta sama luka dotyczyła drugiej, testowej karty — obie mają teraz klucz.

### Zweryfikowane jako poprawne
- **`TESTADMIN`** — jednorazowy (1/1), wygasa 2026-10-20, już wykorzystany; do usunięcia po wygaśnięciu.
- **`POWROT20`** — 20 zł, bez limitu użyć, do 2026-11-01 (kod marketingowy; brak limitu użyć jest tu świadomy).
- **`PREZENT-6D7HYMPJUP`** — karta jednorazowa, wykorzystana (1/1), ważna do 2027-04-14.
- **Kwoty kart i rabaty** liczone po stronie serwera z danych produktu; karta nie obniża ceny innej karty ani nie łączy się ze zwykłym kodem.

## Bilety i wydarzenia — przegląd (2026-10-14)

Zakres: `tickets`, `ticketsAdmin`, moduły `shared/tickets.ts` i `shared/ticketPdf.ts`, strony `/bilet` i `/skaner`.

### Znalezione i naprawione
1. **Nieudane wystawienie biletów było połykane.** `fulfillOrder` logował błąd i szedł dalej: zamówienie było oznaczane jako zrealizowane, mail wychodził bez biletów, a żadna powtórka nie następowała — kupujący płacił i nie dostawał biletów (były tylko do ręcznego odtworzenia w panelu). To dokładnie ta sama wada, którą zamknięto przy kartach podarunkowych. Teraz nieudane wystawienie przerywa realizację (przejęcie zamówienia cofnięte), więc PayU ponowi powiadomienie, a powtórka dopełni brakujące bilety (idempotencja po numerze zamówienia i numerze pozycji). Błąd w samej treści maila (np. nieudany odczyt tytułu wydarzenia) realizacji nie przewraca — bilety są wtedy i tak w Moim koncie.
2. **Publiczny adres PDF biletu nie miał limitu.** `/functions/tickets?pdf=…` składa PDF przy każdym wywołaniu, bez logowania i bez limitu — wygodne narzędzie do obciążania serwera seriami żądań. Dodano limit 60 pobrań na godzinę z jednego połączenia (klucz biletu pozostaje losowy i nieodgadywalny).
3. **`availability` zdradzało cenę i wolne miejsca nieopublikowanego wydarzenia.** Publiczny odczyt po adresie wydarzenia zwracał cenę i liczbę miejsc także dla szkicu i wydarzenia odwołanego — wystarczyło znać adres, żeby poznać cenę zaplanowanej sprzedaży. Teraz dla nieopublikowanych wraca wyłącznie informacja, że sprzedaży nie ma.

### Zweryfikowane jako poprawne
- **`ticketsAdmin`** — każda akcja pod `requireAdmin` (rola `admin`).
- **Panel nie wydaje kluczy biletów** — odpowiedź listy biletów odcina `token`, a do pobrania zostawia gotowe linki (PDF i podglądu), więc klucz nie krąży w danych panelu.
- **PDF tylko po losowym kluczu** — 32 znaki, nagłówki `no-store` i `noindex`, bilet anulowany nie jest wydawany; treść PDF jest w całości rysowana na serwerze (żadnych danych z żądania poza imieniem z bazy).
- **Skaner** — dostęp wyłącznie dla administratora albo osoby z listy uprawnień (e-mail, opcjonalnie jedno wydarzenie i data ważności); sprawdzenie poza swoim wydarzeniem kończy się odmową, a limit 240 sprawdzeń na minutę chroni przed seriami.
- **Wejście na wydarzenie to jedno atomowe przejście „ważny → wykorzystany"** — dwa równoległe skany tego samego biletu nie wpuszczą dwóch osób; cofnięcie (pomyłka przy wejściu) jest osobną, świadomą akcją.
- **Zajętość miejsc** liczona z biletów ważnych i wykorzystanych plus niedokończone płatności z ostatnich 30 minut; sprzedaż zamyka się w terminie z panelu albo 15 minut przed startem.
- **Ceny, terminy i limity miejsc** brane z bazy przy każdym zamówieniu — dane z koszyka są tylko wskazówką, która pozycja i ile osób.
- **Numery i klucze biletów** losowane z ponowieniem przy kolizji; bilety wydawane idempotentnie, a bilet dodany ręcznie w panelu nie ma ceny (nie zaniża sprzedaży).
- **Zapis kupującego na wydarzenie** aktualizuje istniejący wpis i nie cofa statusu „Obecny".

### Świadome wybory (bez zmian)
- **Skaner spoza swojego wydarzenia widzi numer biletu i nazwisko osoby** wraz z odmową — to personel obsługi, a komunikat „ten bilet jest na inne wydarzenie" jest przy wejściu potrzebny.
- **Zajętość sprawdzana jest przy składaniu zamówienia, a nie przy wystawianiu biletów.** Dwie płatności zakończone ponad 30 minut po sobie mogłyby teoretycznie dać o jeden bilet za dużo — okno jest wąskie (niedokończone płatności blokują miejsce przez 30 minut), a uszczelnienie wymagałoby sprawdzenia limitu przy wystawianiu i obsługi zwrotu, gdy miejsc już nie ma. Do rozważenia przy realnym ruchu.

## Kurs, dostęp do lekcji i licencje — przegląd (2026-10-14)

Zakres: `course`, `myAccount` (moje produkty, pliki, kopie PDF), moduły `shared/access.ts`, `shared/pdfLicense.ts`, `shared/videoGuard.ts`, strona kursu i odtwarzacz lekcji.

### Znalezione i naprawione
1. **Dzienniki rosły bez końca, choć polityka obiecuje 90 dni.** Polityka prywatności (§3 pkt 9) mówi wprost: „dzienniki — 90 dni", i wymienia w tym punkcie adres IP, dane urządzenia i przeglądarki oraz dziennik odtworzeń. Tymczasem `PlaybackLog` (każde odtworzenie lekcji i nagrania) i `SecurityLog` (każde zgłoszenie z formularza, pobranie PDF, przekroczenie limitu) nie były usuwane przez nic — rosły bez ograniczenia, a to właśnie w nich leżą adresy IP. Teraz zadanie cykliczne (co 15 minut) czyści oba po 90 dniach, obok pozostałych danych objętych tym samym punktem polityki. Sprawdzone na bazie: zapytanie po dacie działa, obecnie nic nie jest starsze niż 90 dni, więc pierwsze czyszczenie nic nie usunie.
2. **Automatyczna blokada po czwartym adresie IP zastąpiona powiadomieniem (decyzja właściciela).** Czwarty różny adres IP w ciągu 24 godzin blokował odtwarzanie na dobę bez pytania nikogo — przy telefonie z danymi komórkowymi (wielu operatorów zmienia adres w ciągu dnia) albo przy zmiennym adresie od dostawcy trafiało to w uczciwego klienta, który musiał czekać na ręczne odblokowanie. Teraz odtwarzanie **nie jest wstrzymywane**: sygnał trafia do administratora mailem („podejrzenie współdzielenia konta") i wpisem w panelu (Bezpieczeństwo), a decyzję podejmuje człowiek — odebranie dostępu w sekcji „Klienci i dostępy". Powiadomienie leci raz na 12 godzin na konto, żeby alarm nie powtarzał się przy każdym odtworzeniu. Limit 60 odtworzeń na godzinę zostaje bez zmian (chroni serwer przed serią żądań), a sprawdzanie wcześniejszych blokad działa dalej — gdyby blokada została kiedyś nadana ręcznie, konto ją respektuje.

### Zweryfikowane jako poprawne
- **Dostęp sprawdzany od sesji, nigdy od żądania.** `course` i `myAccount` biorą adres e-mail z zalogowanego konta i porównują go z właścicielem dostępu — podstawienie cudzego identyfikatora dostępu kończy się odmową, podobnie jak dostęp odebrany albo wygasły (`isActive`).
- **Lekcja musi należeć do opłaconego produktu** (inaczej 404), a spis lekcji pokazuje wyłącznie lekcje opublikowane.
- **Wideo z prywatnego magazynu** wychodzi tylko podpisanym linkiem na godzinę; adresy zewnętrzne są sprawdzane przy każdym odtworzeniu, więc zdjęcie domeny z listy zamyka dostęp natychmiast.
- **Znak wodny** zawiera adres, numer licencji i datę odtwarzania; odtwarzacz sprawdza co 3 sekundy, czy znacznik istnieje i jest widoczny — usunięcie go wstrzymuje film i zapisuje zdarzenie.
- **Jedno odtwarzanie naraz** — nowa sesja przejmuje konto, a starsza dostaje zatrzymanie przy najbliższym zapisie postępu.
- **Limity oglądania** — 60 odtworzeń na godzinę na konto; dziennik odtworzeń jest podstawą wykrywania współdzielenia konta i podlega teraz czyszczeniu po 90 dniach.
- **Kopie PDF są imienne i powstają raz na dostęp** — napis licencji na każdej stronie, znak wodny przez środek, ukryty identyfikator i blokada edycji; kopia tworzy się od nowa tylko przy zmianie wersji oznaczeń, a plik wydawany jest podpisanym linkiem na 10 minut. Pobranie trafia do rejestru.
- **Postęp lekcji** zapisywany wyłącznie dla zalogowanej osoby i tylko dla lekcji z jej produktu; zgoda licencyjna zapisywana na koncie z datą.
- **Baza:** `Access` i `LessonProgress` czytelne dla właściciela (albo administratora) i zapisywalne wyłącznie po stronie serwera; `License`, `ActiveStream` i `PlaybackLog` dostępne tylko dla administratora.

### Do rozważenia
- **Konto do oglądania nie jest czyszczone z nieaktywnych wpisów** — jeden wiersz na osobę, która kiedykolwiek odtwarzała materiał; przy obecnej skali bez znaczenia.

## Ryzyka otwarte (bez zmian)
1. Wylogowanie ze wszystkich urządzeń — ograniczenie platformy.
2. Podpisane linki do plików działają do 1 godziny.
3. Klucz `service_role` Supabase trzymany w pamięci instancji (1 h), nigdy w logach ani odpowiedzi.
4. Poczta: do czasu konfiguracji SMTP przypomnienia czekają w kolejce (bez utraty danych).
5. Limity publicznych formularzy działają per IP; przy braku nagłówka adresu (rzadkie) przepuszczają — świadomy wybór, żeby formularz nigdy nie zniknął przez licznik.
6. **Licznik użycia kodu rośnie dopiero po opłaceniu, a limit `max_uses` sprawdzany jest przy tworzeniu zamówienia.** Dwa równoległe zamówienia z tym samym kodem jednorazowym (karta podarunkowa) mogą przejść oba — okno to kilka sekund, ale przy karcie oznacza podwójne wykorzystanie kwoty. Uszczelnienie wymaga atomowego „rezerwuję kod" po stronie bazy; encje Base44 nie mają warunkowego zapisu z potwierdzeniem, więc trzeba by przenieść licznik do tabeli w Supabase. Do rozważenia, gdy pojawi się realny ruch.
7. **Zamówienie za 0 zł, którego realizacja się nie powiedzie, zostaje w stanie PENDING bez ponowienia** — nie ma powiadomienia PayU, które by je wywołało ponownie; wymaga dokończenia ręcznie w panelu.
8. **`ensureOrdersTable` w `shared/orders.ts` ma martwy blok DDL** (zaraz po `return;`) — nie szkodzi, ale myli przy czytaniu kodu.
9. **Limit „20 wiadomości na godzinę" liczy wysyłki, nie odbiorców.** Jedna wiadomość do 500 osób to jedno wysłanie — limit nie chroni więc przed jednorazowym obciążeniem serwera poczty. Świadomy wybór: to narzędzie obsługi, nie kanał masowy.
10. **Wysyłka masowa jest wciąż synchroniczna.** Partie po 6 skracają czas kilkukrotnie, ale przy kilkuset odbiorcach i wolnej poczcie funkcja może się przerwać w połowie, a wiadomość jest już oznaczona jako wysłana. Docelowo: wrzucenie wysyłki do kolejki i rozłożenie jej na zadanie cykliczne.
11. **`arr()` w `libraryAdmin` to martwy kod** (zdefiniowany, nigdzie nie używany) — do usunięcia przy okazji.
13. **Karty podarunkowe powstawały pojedynczo i przerwanie w połowie zostawiało mniej kart, niż kupiono** (kupujący zapłacił za trzy, dostał jedną, żaden mail nie wyszedł). **NAPRAWIONE** — komplet rozpoznawany jest teraz per pozycja (kwota + dedykacja), więc powtórka dokłada brakujące karty, a już wydanych nie dubluje; cały komplet trzyma jedną datę ważności.
14. **Sprawdzanie stanu zamówienia po powrocie z PayU nie ma limitu** (celowo, żeby strona powrotu działała). Odpytywanie idzie po losowym numerze zamówienia i zwraca wyłącznie status, więc nie da się z tego odczytać danych osobowych.
15. **Rachunek „suma pozycji minus zapłata" w statystykach zakłada, że pozycje zamówienia są zapisane przed rabatem.** Tak jest dzisiaj i tak zostanie, dopóki nikt nie zmieni sposobu zapisu pozycji — przy takiej zmianie trzeba poprawić i ten wzór.
16. **Bilety: limit miejsc sprawdzany przy składaniu zamówienia, nie przy wystawianiu.** Dwie płatności zakończone ponad 30 minut po sobie mogą teoretycznie dać o jeden bilet za dużo (niedokończone płatności blokują miejsce tylko przez 30 minut). Uszczelnienie wymaga sprawdzenia limitu przy wystawianiu i obsługi zwrotu, gdy miejsc już nie ma — do rozważenia przy realnym ruchu.
17. **Pobranie PDF biletu zapisuje wpis w rejestrze bezpieczeństwa.** Limit 60 na godzinę chroni adres, ale przy dużym wydarzeniu (wielu kupujących za jednym adresem sieciowym) dziennik rośnie — jeśli zacznie przeszkadzać, limit trzeba przenieść na licznik w pamięci instancji.
18. **Blokada odtwarzania po czwartym różnym adresie IP w 24 godzinach.** **NAPRAWIONE** — automatyczna blokada zastąpiona powiadomieniem do administratora (mail + wpis w panelu Bezpieczeństwo), raz na 12 h na konto; odtwarzanie nie jest już wstrzymywane, a decyzję podejmuje człowiek.
19. **Lista klientów w panelu pobiera do 2000 rekordów i zawęża wynik w przeglądarce.** Działa, ale przy większej liczbie kont będzie to najwolniejsze miejsce panelu — warto przenieść filtrowanie do zapytania.

## Ogłoszenia, powiadomienia i spotkania — przegląd (2026-10-14)

Zakres: `announcements`, `notifications`, `eventsPublic`, `eventsAdmin`, moduły `shared/announce.ts` i `shared/smtp.ts`.

### Znalezione i naprawione
1. **Dzwoneczek mielił bazę.** Każde wejście na listę powiadomień sprawdzało przynależność do grupy osobno dla każdego ogłoszenia — osobne zapytanie do bazy na ogłoszenie, a przy grupie „wszyscy” jeszcze raz pobierana lista wszystkich kont. Teraz przynależność liczona jest zbiorczo: najwyżej trzy zapytania na całą listę, a liczba odbiorców jednej grupy pobierana raz. Zachowanie identyczne, obciążenie nieporównywalnie mniejsze.
2. **Panel ogłoszeń wysyłał setki zapytań.** Przy 200 ogłoszeniach lista robiła cztery zapytania na każde (liczba odbiorców + trzy liczniki odsłon, kliknięć i zamknięć), w tym wielokrotnie pełną listę kont. Teraz liczniki pobierane są trzema zapytaniami zbiorczymi, a grupa odbiorców liczona raz na cel. Panel otwiera się natychmiast.
3. **Publiczny adres przypomnień bez limitu.** `eventsPublic` z akcją „przypomnij” przyjmuje adres e-mail i zapisuje go w bazie, nie wymagając logowania — bez limitu dawał się zapełnić dowolnymi adresami. Dodany limit 5 zgłoszeń na godzinę z jednego połączenia (ten sam mechanizm co w pozostałych formularzach publicznych).
4. **Wysyłki do uczestników spotkania szły po jednej wiadomości.** Odwołanie spotkania, zmiana terminu, przypomnienie, wysyłka nagrania i wiadomość do uczestników wysyłały maile sekwencyjnie — przy spotkaniu na kilkaset osób funkcja urywała się w połowie i część osób nie dostawała wiadomości, choć panel pokazywał sukces. Wszystkie te wysyłki idą teraz partiami po 6.
5. **Uproszczenie: jeden nadmiarowy import i podwójne liczenie tokenu wejścia** w `eventsPublic` (token liczony dwa razy przy każdym odczycie zapisu) — bez wpływu na działanie, usunięte przy okazji.

### Zweryfikowane jako poprawne
- **Panel ogłoszeń i powiadomień** — akcje administracyjne pod `requireAdmin`; osoba widzi wyłącznie ogłoszenia skierowane do grup, do których faktycznie należy (zakupiony produkt, uczestnictwo w serii, zapis na spotkanie), liczone po adresie z zalogowanej sesji.
- **Publiczny adres przypomnień** nie ujawnia danych innych osób — odpowiada wyłącznie potwierdzeniem przyjęcia zgłoszenia, a przy braku wydarzenia zwraca ogólny komunikat.
- **Wysyłka do uczestników** ograniczona do administratora, treść czyszczona, a przy błędzie pojedynczej wiadomości pozostałe i tak wychodzą.
- **Baza**: tabele ogłoszeń mają włączony RLS, a funkcje dostępne wyłącznie po stronie serwera.

### Testy wykonane
- `announcements` (lista panelu) — odpowiedź poprawna, brak zapytań do listy kont przy pustej liście ogłoszeń.
- `eventsPublic` (przypomnienie dla nieistniejącego spotkania) — poprawna odmowa, bez zapisu danych; wpis testowy limitu usunięty z rejestru bezpieczeństwa.
- Zapytanie zbiorcze liczników sprawdzone bezpośrednio na bazie (kolekcja obecnie pusta, zapytanie wykonuje się bez błędu).

## Strony treści i szybkość strony głównej — przegląd (2026-10-14)

Zakres: `CmsPage`, `CmsPreview`, `About`, `Powrot`, `Kontakt`, `Listopad`, `siteContent`, `siteSettings`, `sitemap`, `usePublishedPage`, `BlockRenderer`, `sanitizeHtml`, start strony głównej (`Home`, `HomeSwitch`, `prefetch`, `index.html`, `vite.config.js`).

### Zweryfikowane jako poprawne
- **Wersje robocze nie wyciekają.** Gość czyta wyłącznie `PublishedPage` — kopię opublikowanej wersji (`usePublishedPage`, `bootstrap`, `cmsScheduled`). Wersje robocze (`SitePage`) i historia (`PageVersion`) nie są podawane żadną publiczną ścieżką. Podgląd szkicu (`/admin/podglad-strony`) stoi za logowaniem i pobiera bloki komunikatem z edytora, nie z bazy.
- **Sitemap nie ujawnia szkiców.** Mapa zawiera listę stałą, aktywne (nieukryte) produkty, opublikowane spotkania i opublikowane odcinki podcastu. Strony z edytora nie trafiają do mapy, więc niepublikowana treść nie może się w niej znaleźć.
- **Oczyszczanie HTML z panelu.** `sanitizeHtml` działa na białej liście znaczników, usuwa `SCRIPT`, `STYLE`, `IFRAME`, `OBJECT`, `EMBED` i `FORM`, odrzuca `javascript:`, `data:` oraz adresy bez protokołu (`//obca-domena`), przepuszcza wyłącznie `https://`, ścieżki tej strony, kotwice, `mailto:` i `tel:`, a linki zewnętrzne dostają `rel="noopener noreferrer"`. Używane w blokach CMS, ROZDROŻACH, produktach, spotkaniach, odcinkach, bibliotece i wiadomościach.
- **Meta strony.** Adres kanoniczny i obrazek udostępniania ustawiane są przez `usePageMeta`; opis i tytuł nadpisuje `SeoMeta` przy zmianie adresu, a strony z danymi dochodzącymi później (spotkanie, produkt) — przez `useDocMeta`. Brak konfliktów (SeoMeta nie ustawia kanonicznego).
- **404.** Nieistniejący adres poza routerem (`*`) oddaje `PageNotFound` z `noindex`.

### Znalezione i naprawione
1. **Przełączniki SEO z edytora były martwe.** `noindex` („ukryj przed wyszukiwarkami”) i `seo_image` („obrazek udostępniania”) zapisywano przy publikacji, ale **nikt ich nie czytał** — strona oznaczona jako ukryta i tak trafiała do wyszukiwarek, a obrazek udostępniania nigdy się nie pokazywał. Teraz `noindex` jest respektowany w `usePublishedPage` (obejmuje strony z edytora, strony stałe i stronę główną), a `/strona/:slug` dostaje adres kanoniczny, obrazek udostępniania (tylko pełne adresy `https`) i opis z edytora.
2. **Miękkie 404 dla `/strona/:slug`.** Nieistniejąca strona oddawała treść 404, ale z tytułem i opisem strony głównej i bez `noindex` — wyszukiwarka widziała kopię strony głównej pod każdym wymyślonym adresem. Teraz to `PageNotFound` (własny tytuł, opis i `noindex`).
3. **Tytuł strony z edytora.** Strona bez ustawionego `seo_title` pokazywała tytuł strony głównej; teraz tytuł powstaje z nazwy strony.

### Szybkość strony głównej
**Zmiana (mała, bezpieczna).** `AdminModeProvider` pytał o konto (`auth.me()`) przy każdym wejściu na stronę — także u gościa bez logowania, gdzie odpowiedź i tak nie może być administratorem. To zbędne zapytanie w starcie (konkuruje z `bootstrap`). Teraz pytanie idzie tylko wtedy, gdy w przeglądarce jest token; zachowanie bez zmian.

**Zmierzone.** Publikacja ładuje **44 pliki JavaScript (198 KB po kompresji)** zanim cokolwiek się pokaże, w tym cały moduł bloków CMS (`modules`, 47 KB gzip) — wciągany do pierwszej paczki przez `HomeSwitch` → `Home`/`Listopad` → `CmsRoutePage` → `BlockRenderer` i moduły. Do tego dochodzi `Admin` (872 KB surowo) w osobnej paczce — dobrze, że nie w pierwszej.

**Czego NIE zmieniano.** Mechanizm przedpremierowy i `src/content/landingShell.html` działają jak dotąd: do 1.11 21:30 gość na „/” dostaje gotowy HTML (nagłówek + główne zdjęcie) wstawiany skryptem z `vite.config.js`, a React podmienia go identyczną treścią. Warunek wyłącza się sam po dacie premiery.

**Co trzeba zrobić po 1.11, żeby opublikowana strona „home” startowała równie szybko** (do wdrożenia dopiero po premierze, bo każda z tych zmian opóźnia dziś podmianę gotowego HTML):
1. **Rozdzielić paczki.** `HomeSwitch` (i `Home`/`Listopad`) nie powinny wciągać `BlockRenderer` i modułów do pierwszej paczki — wtedy menu i tło wchodzą od razu, a bloki treści dochodzą osobnym plikiem. Dziś zrobienie tego przed 1.11 jest szkodliwe: gotowy HTML znika w chwili pierwszego rysunku Reacta, więc odroczenie bloków pokazałoby czarny ekran zamiast nagłówka.
2. **Ograniczyć listę `modulepreload`.** Z 44 plików wstępnie ładowanych zostawić czcionkę i obraz nagłówka, resztę doładowywać naturalnie — na telefonie to jedno pełne zapytanie mniej przed pierwszym obrazem.
3. **Usunąć zależność pierwszego widoku od `bootstrap`.** Mechanizm już istnieje: `usePublishedPage` rysuje kopię z pamięci przeglądarki (`swrCache`) i odświeża w tle. Po premierze wystarczy oprzeć pierwszy rysunek strony głównej na tej kopii (albo na treści wbudowanej), zamiast czekać do 2 s na odpowiedź serwera.
4. **Ponownie zmierzyć po premierze.** Cały koszt startu (te 198 KB) wróci wtedy do aplikacji, bo gotowy HTML przestanie się wstawiać — warto wtedy sprawdzić stronę główną PageSpeedem i dopiero na tych liczbach ciąć dalej.

**Drobiazgi bez zmian.** Obrazy (`SafeImg`) mają poprawnie ustawione `loading`/`fetchpriority` (nagłówek `eager` + `high`, resztę `lazy`); nie mają atrybutów `width`/`height`, ale rozmiar ustalają kontenery, więc nie powodują przesuwania układu.

### Uwaga (niski priorytet, bez zmian)
Komponenty treści spoza bloków CMS (`ContactSection`, `Footer`, `NewsletterSection`, `ForWhom`, `PowrotTeaser`, `Testimonials`) wstawiają HTML z panelu bez `sanitizeHtml`. Treść pochodzi wyłącznie z panelu (rola `admin`/`techniczna`), więc nie jest to droga z zewnątrz, a sanitizacja usunęłaby atrybuty `style` (mogłaby zmienić wygląd). Do rozważenia przy okazji, razem z `ContactSection`.

### Testy wykonane
- Publikacja przechodzi bez błędów (`vite build`, kod wyjścia 0), więc zmiany w `CmsPage` i `usePublishedPage` się kompilują.
- Przegląd wyłącznie do odczytu: bez wysyłki maili, bez usuwania danych, bez publikowania stron z panelu.
- Zmierzona waga pierwszej paczki (44 pliki, 198 KB po kompresji) i przynależność modułu bloków do paczki startowej.

## RODO, newsletter, zmiana adresu i OBOK — przegląd (2026-10-14)

Zakres: `gdprPerson`, `shared/gdpr.ts`, `adminNewsletter`, `subscribeNewsletter`, `shared/newsletter.ts`, `shared/smtp.ts`, `emailChange`, `obok`, `shared/obok.ts`, strony list i panel klienta.

### Zasięg danych osobowych — dopisane brakujące miejsca
Eksport i usuwanie danych obejmowały dotąd tylko część miejsc, w których leży adres osoby. Dopisane:
- **Bilety na spotkania (`event_tickets`)** — eksport i usuwanie. Bilet opłacony zostaje jako zapis sprzedaży (obowiązek podatkowy), ale **zanonimizowany**: imię i nazwisko zastępuje napis „dane usunięte (RODO)", a adres wykupującego znika. Bilety bezpłatne (cena 0) nie mają wartości księgowej, więc są usuwane w całości.
- **Zamówienia (`orders`)** — wiersz zostawał dotąd nietknięty. Teraz anonimizowane są w nim dane osobowe: imię i nazwisko, telefon, zgoda na telefon i notatka znikają, a z pozycji zamówienia usuwane są dedykacje kart podarunkowych („od kogo", „dla kogo"). Numer, data i kwoty zostają.
- **Karty podarunkowe (`DiscountCode`)** — dane kupującego i obdarowanego oraz klucz wydruku są usuwane; kod i kwota zostają (to one są dowodem).
- **Kody zarezerwowane przy nieopłaconym zamówieniu (`discount_reservations`)** i **klucze linków do zarządzania rezerwacją albo pakietem (`bk_tokens`)** — usuwane w całości, nie mają wartości księgowej.
- **Dziennik wysłanej poczty (`MailQueue`)** — usuwany.
- **Proces zmiany adresu (`EmailChange`)** — kopia wszystkich danych osoby (cały jej stan przed przeniesieniem) jest usuwana, a oba adresy w zakończonych procesach zastępowane. W procesach w toku adresy zostają, bo są jeszcze potrzebne do przeniesienia.
- **Lista adresów zamrożona przy przydziale grupowym (`mb_assignments.snapshot_emails`)** — adres usuwany również z cudzych wierszy, w których ta osoba była w chwili przydziału.

Dwie tabele (`event_tickets`, `discount_reservations`) powstają dopiero przy pierwszym użyciu — brak tabeli przerywał cały eksport, więc jest teraz traktowany jak brak danych.

### Newsletter i Listy powrotu
**Znalezione i naprawione**
1. **W mailu kampanii nie było linku wypisu** — tylko zdanie „odpowiedz STOP". Teraz każdy list zawiera link wypisu działający bez logowania (nowa strona `/listy/wypis`, po samym kluczu, tak samo jak potwierdzenie zapisu). Klucz wypisu zakładany jest w bazie raz, także dla adresów zapisanych wcześniej.
2. **Ponowny zapis po wypisie nie dawał żadnej odpowiedzi.** Adres wypisany (albo niepotwierdzony) trafiał na „nic nie rób", więc nie dostawał maila z potwierdzeniem i pozostawał wypisany. Teraz ponowny zapis wysyła świeży link potwierdzający, a adres już potwierdzony zostaje aktywny (bez ponownego maila).

**Zweryfikowane jako poprawne**
- **Potwierdzenie zapisu (double opt-in) działa.** Nowy adres trafia jako „oczekujący", aktywny staje się po kliknięciu linku (data zgody = data kliknięcia), a niepotwierdzony jest usuwany po 7 dniach. Link potwierdzający jest jednorazowy, ważny 7 dni, a strona potwierdzenia działa bez logowania.
- **Wysyłka masowa idzie partiami** (10 adresów na jedno wywołanie, panel powtarza do końca): wiadomości nie lecą już pojedynczo, a przerwanie w połowie nie zaczyna od nowa. Odbiorca zapisany jest dopiero po faktycznej wysyłce i tylko raz (unikalny klucz w bazie), więc ponowienie nie dubluje listów.
- **Kampania wysyła wyłącznie do potwierdzonych** (`status = 'active'`) i wyłącznie do osób z wybranej grupy; kampania oznaczona jako wysłana nie da się już edytować.
- **Limity:** zapis na listę — 5 na godzinę z jednego połączenia. Wypis i potwierdzenie celowo bez limitu (klucz jest nieodgadywalny), żeby link w starym mailu działał zawsze.

**Do rozważenia (bez zmian)**
- Przerwanie wysyłki dokładnie w trakcie partii może powtórzyć kilka listów — odbiorcy zapisywani są po całej partii, nie po każdym liście.
- Wypis nie trafia do rejestru bezpieczeństwa; sam fakt wypisu widać na liście odbiorców.

### Zmiana adresu i moduł OBOK
**Zweryfikowane jako poprawne**
- **Zmiana adresu (`emailChange`):** każda akcja panelu wymaga roli administratora; link potwierdzający jest jednorazowy (w bazie wyłącznie skrót), ważny 48 godzin, a użycie po terminie kończy się komunikatem ogólnym. Nowy adres nie może należeć do istniejącego konta. Przeniesienie najpierw robi kopię wszystkich danych, a przy niepowodzeniu wraca do stanu wyjściowego; konto stare jest blokowane, a nowe zapraszane raz, nie przy każdym wejściu do panelu.
- **Moduł OBOK (`obok`):** wszystkie akcje poza wypisem wymagają zalogowania i sprawdzają dostęp do serii (status, przynależność, zakupiony produkt); administrator ma własną ścieżkę. Nagranie wychodzi tylko wtedy, gdy jest odblokowane, i wyłącznie podpisanym linkiem. Publiczna informacja o serii to sama nazwa, krótki opis i daty — bez nagrań i cen.
- **Wypis z powiadomień OBOK** działa bez logowania po samym kluczu (klucz trwały, żeby link w starym mailu nie przestał działać).

**Uwaga**
- Zadanie cykliczne zmiany adresu jest publiczne (bez logowania), ale chronione blokadą czasową: jedno uruchomienie na kilka minut, a w tym czasie wykonuje realną pracę (przeniesienie danych, zaproszenie). Przy obecnej skali bez znaczenia — do rozważenia, gdyby ruch wzrósł.
- Link do nagrania OBOK jest ważny 3 godziny (w pozostałych modułach 1 godzina) — jeśli to za długo, warto skrócić.

### Testy wykonane
- `gdprPerson` (eksport) na nieistniejącym adresie — odpowiedź poprawna, pusta lista, bez błędu; usuwania danych nie uruchamiano.
- `subscribeNewsletter` (wypis) z nieprawidłowym kluczem — odpowiedź poprawna, bez zmiany danych.
- Publikacja przechodzi bez błędów (`vite build`, kod wyjścia 0).
- Sprawdzone w kodzie: filtr wysyłki kampanii (`status = 'active'` + grupa + brak powtórzeń), czas życia linków, wymóg roli administratora w obu modułach.
- Przegląd wyłącznie do odczytu: bez wysyłki maili, bez usuwania danych.