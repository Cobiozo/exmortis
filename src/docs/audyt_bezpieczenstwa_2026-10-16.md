# Audyt bezpieczeństwa — exmortis (2026-10-16)

Rola: AppSec / architekt bezpieczeństwa. Zakres: wszystkie 59 encji (RLS), 63 funkcje serwerowe, moduły `base44/shared/`, frontend (sekrety, XSS), ścieżki płatności i plików. Bez zmian w kodzie — tylko raport.
Metoda: ręczne czytanie reguł dostępu wszystkich encji, przegląd ścieżek autoryzacji i walidacji w funkcjach, skan frontendu pod kątem sekretów i wstrzykiwania HTML, weryfikacja interpolacji SQL, spot-check publicznych funkcji.
Kontekst: poprzednie skany z 13–15.10.2026 — dziś ponownie zweryfikowano te same obszary plus nowe funkcje; poziom bezpieczeństwa jest konsekwentnie wysoki.

---

## 1. Autoryzacja i kontrola dostępu (IDOR / Broken Access Control)

**Stan: dobra.** Zestawienie reguł:
- **Publiczny odczyt (treści, bez danych osobowych):** `PublishedPage`, `SiteNav`, `PodcastSettings`, `SilenceSettings`, `Utwor`, `LegalDocVersion`, `PageRedirect`. Zapis w każdej z nich tylko `admin`/`techniczna`. `PodcastEpisode` i `PodcastPlaylist` — publicznie tylko status opublikowany/widoczna. Celowe i poprawne.
- **Dane klientów:** `Access` i `LessonProgress` — odczyt tylko właściciel (`{{user.email}}`) albo admin. Wszystko pozostałe (Access, zamówienia, zgłoszenia, uczestnicy, logi, ustawienia wrażliwe) — wyłącznie `admin`, zapis z przeglądarki niemożliwy.
- **`User`** — encja wbudowana, bez własnych reguł (platforma pilnuje: cudze konta tylko dla admina, klient nie tworzy rekordów). Nie dodajemy własnych reguł.
- **Panel `/admin`:** UI sprawdza rolę (`Admin.jsx`: odrzuca poza `admin`/`techniczna`), a KAŻDA akcja funkcji `admin*` ponownie sprawdza rolę serwerowo (`requireAdmin` w `shared/supabase.ts`: `me().role !== "admin"` → odmowa). Ukrycie w UI nie jest jedyną warstwą — jest i backend.
- **IDOR (User A→User B):** funkcje konta (`myAccount`, `mySettings`, `course`, `obok`, `library`, `myEvents`, `notifications`, `emailChange`) biorą tożsamość WYŁĄCZNIE z sesji (`base44.auth.me()`), a identyfikatory z żądania tylko porównują z sesją. Zweryfikowane: `course` → `Access.get(access_id)` z porównaniem `a.user_email !== email` → 403; `reviews` → zamówienie musi należeć do sesji; `obok` → członkostwo po e-mailu sesji; `media` (obrazy prywatnej biblioteki) → losowy `pub_id` (32 hex), kontrola pochodzenia żądania, limit IP, `noindex`.
- **Blokada konta `zablokowane`** egzekwowana w każdej funkcji konta (403).
- Wzorzec: encje mają zapis zamknięty (admin/nikt), a rekordy tworzy serwisowo funkcja po własnej walidacji — klient nie ma drogi bezpośredniego zapisu.

**Brak znalezionych luk w tej kategorii.**

## 2. Sekrety i klucze API

**Stan: dobra.**
- Skan frontendu (`src/`, `public/`): **zero zahardkodowanych kluczy, tokenów ani haseł**. `import.meta.env` używane wyłącznie dla identyfikatorów platformy (nie sekretów).
- Wszystkie integracje płatne/wrażliwe idą przez funkcje serwerowe: PayU (klucze w ustawieniach aplikacji, odczyt tylko serwisowy), SMTP, Instagram Graph API (token nigdy w odpowiedzi), Fakturownia, Google Calendar/Zoom tokeny.
- Sekrety środowiskowe `BOOKING_ENC_KEY` / `BOOKING_HMAC_KEY` — używane tylko po stronie serwera (`bookingCrypto.ts`, szyfrowanie AES-256-GCM danych zdrowotnych).
- Ustawienia publiczne: `publicSettings` zwraca **białą listę** pól (`firma`, `premiera`, `dokumenty`, `pomiar`, `aplikacja`) — klucze `payu`/`smtp`/`mb_settings` NIE wyciekają do gościa (zweryfikowane w kodzie).
- Pliki: produkty i bilety w `UploadPrivateFile` (prywatne), podpisywane linki 1 h; okładki/cover w `UploadPublicFile` (publiczne) — treści marketingowe, dopuszczalne.

## 3. Walidacja i wstrzyknięcia (XSS / SQL Injection)

**Stan: dobra, dwa zastrzeżenia niżej.**
- **SQL:** wszystkie dane od użytkownika przechodzą przez `escStr`/`esc` (dollar-quoting z unikalnym ogranicznikiem) lub twarde rzutowanie na liczbę (`Number(x) || n`, whitelist `[7,30,90,365]` dla statystyk). Nazwy tabel/kolumn interpolowane wyłącznie ze stałych. Publiczne funkcje sprawdzone punktowo — czysto.
- **XSS:** 24 miejsca z `dangerouslySetInnerHTML` w frontendzie — **wszystkie** przez `sanitizeHtml()` (DOMParser + whitelist znaczników/atrybutów, tylko https/ścieżki/#/mailto/tel, wymuszone `rel="noopener noreferrer"`) albo na treściach stałych. Treści z biblioteki sanitizowane dodatkowo na serwerze (`librarySanitize.ts`, tokenizacja znaczników). Opinie: body jako tekst, bez raw HTML.
- **Formularze:** wspólne walidatory (`textField` z limitem długości, `emailField`, regex na slug/tokeny), pola-pułapka na boty w kontakcie, HTML maili budowany z escapowanych pól (`escapeHtml`/`esc`).
- **Pliki:** upload tylko z panelu admina (nie ma ścieżki uploadu dla klienta); prywatne pliki z podpisanymi linkami.

## 4. Logika biznesowa, nadużycia, Mass Assignment

**Stan: dobra, dwie luki niżej.**
- **Limity na IP** przed każdą akcją z wysyłką maili / zapisem: kontakt 5/h, odstąpienie 5/h, darmowe pobrania 5/h, newsletter 5/h (double opt-in), zapisy na spotkania 8/h + przypomnienia 5/h, rezerwacje 5/10 min + 3/e-mail/h (HMAC), kasa 20/h, rabaty 10/h, quiz 10/h, waitlista 10/h, podcast 3/h, karta podarunkowa 30/h, błędy klienta 10/h, statystyki ciszy 60/h. IP z nagłówków brzegowych (`True-Client-IP`, nadpisywany przez platformę — zweryfikowane; X-Forwarded-For świadomie pominięty).
- **Ceny i stany płatności:** liczone wyłącznie na serwerze z bazy (ceny, promocje, kroki cenowe, limity miejsc, rabaty); koszyk z przeglądarki to tylko wskazówka. Klient nie zapisuje statusów zamówień.
- **Webhook PayU:** podpis OpenPayU weryfikowany stałym porównaniem (`safeEqual`), idempotencja `claimCompletion` (powtórki PayU nie dublują dostępu ani maili).
- **Mass Assignment / role:** profil klienta aktualizowany tylko przez `updateMe` (imie, zgody, czas akceptacji) — roli nie da się ustawić; encja User bez zapisu dla klienta. Funkcje admina weryfikują rolę serwerowo.
- **Postęp lekcji / odślucho** — zapis tylko przez funkcje serwerowe, dla adresu z sesji.

## 5. Obsługa błędów i wyciek informacji

Patrz W1 — miejscami surowe komunikaty wychodzą do klienta; większość funkcji (mySettings, withdrawal, giftCardView, media) już zwraca komunikaty generyczne.

---

# ZNALEZIONE LUKI

## W1 — Surowy tekst błędu w odpowiedziach publicznych funkcji
- **[POZIOM RYZYKA]: Średni — NAPRAWIONO 2026-10-16** (wspólny moduł `base44/shared/errors.ts`: błąd walidacji = 400 z komunikatem, reszta = 500 z komunikatem generycznym, szczegóły w logach; przebudowano createContactMessage, checkDiscount, bootstrap, siteSettings, siteContent, gdprPerson, clientError, payuCreateOrder; przetestowane)
- **[LOKALIZACJA]:** `createContactMessage` (catch → `error.message`, 400), `bootstrap` (500), `checkDiscount` (400), `siteSettings`, `siteContent` (500), `gdprPerson` (500), `clientError` (500), `obok` (miejsca z `error.message`).
- **[OPIS PROBLEMU]:** Przy nieoczekiwanym błędzie (np. utracone połączenie do bazy, błąd SQL) tekst wyjątku trafia do przeglądarki i może ujawnić nazwy tabel/kolumn, strukturę zapytań lub ścieżki — dokładnie to, czego szuka każda zautomatyzowana próba. Nie jest to przejęcie konta, ale osoba eksplorująca dostaje mapę bazy za darmo.
- **[ROZWIĄZANIE]:** W każdej z wymienionych funkcji ostatni `catch` zamienić na wzorzec już stosowany w `mySettings`: `console.error(error); return Response.json({ error: "Coś poszło nie tak. Spróbuj za chwilę." }, { status: 500 })`. Walidowane komunikaty (zwykle zaczynające się od znanego prefixu, np. w `reviews` regexpem `^(Opinia|Podpis|Odpowiedź)`) przepuszczaj dalej — to wzorzec, który aplikacja już ma. Nie łap błędów walidacji tym samym rębem: rozróżnij 400 (komunikat dla formularza) od 500 (generyczny).

## W2 — Wyścig licznika `max_uses` kodów rabatowych
- **[POZIOM RYZYKA]: Średni — ZWERYFIKOWANO: ZAMKNIĘTY W KODZIE (bez zmian)**. Kody z limitem użyć są rezerwowane atomowo już przy składaniu zamówienia: `reserveCode` (blokada advisory w bazie, rezerwacje na 30 min, ponowna próba po nieudanej płatności tego samego adresu dozwolona) w `shared/discounts.ts`, podpięte w `payuCreateOrder` (rezerwacja po numerze zamówienia, zwolnienie przy błędzie) oraz `fulfillOrder` po opłaceniu (`markCodeUsed` + licznik z liczbą wykorzystanych rezerwacji). `checkDiscount` czyta licznik bez atomowości, ale to tylko podgląd — egzekucja jest w kasie. Reszta ryzyka: ten sam adres z dwoma równoległymi zamówieniami z tym samym kodem jednorazowym przejdzie oba (celowy kompromis, by nie blokować ponawiania płatności; skutek dotyczy tylko tej samej osoby).
- **[LOKALIZACJA]:** `shared/discounts.ts` (`applyDiscount`) + `checkDiscount` / `payuCreateOrder`; encja `DiscountCode` (pole `uses`).
- **[OPIS PROBLEMU]:** Odczyt `uses`, walidacja i zapis nie są atomowe. Kilkanaście równoległych zamówień z tym samym jednorazowym kodem (osobne żądania w poniżej-sekundowym oknie) wszystkie odczyta `uses = 0` i wszystkie przejdą — kod „jednorazowy" zrealizuje wiele zakupów. Limit 10/h na IP nie przeszkadza: druga osoba albo rozproszone żądania z różnych IP (VPN) omijają limit.
- **[ROZWIĄZANIE]:** Inkrement atomowy w Supabase zamiast odczyt+update: `UPDATE public.discount_codes SET uses = uses + 1 WHERE code = ${escStr(code)} AND active AND (max_uses IS NULL OR uses < max_uses) RETURNING uses, value, kind` — jeśli nie zwróci wiersza, odrzuć kod („limit wykorzystany"). Zastosować w `applyDiscount` tak, by `payuCreateOrder` rezerwował użycie kodu W CZASIE tworzenia płatności (a nie dopiero przy potwierdzeniu) — przy anulowaniu płatności dekrementuj z powrotem (albo akceptuj nieznaczne „zużycie" kodu).

## W3 — Fałszywy sukces płatności w Safari prywatnym / z blokerami
- **[POZIOM RYZYKA]: Średni** (znany problem; decyduje o rozliczeniach)
- **[LOKALIZACJA]:** `src/pages/Checkout.jsx` (potwierdzenie po powrocie z PayU), `payuCreateOrder`, `payuNotification`.
- **[OPIS PROBLEMU]:** Ekran kasy pokazuje sukces w oparciu o przepływ po stronie przeglądarki (redirect/callback). Safari prywatny i blokery skryptów ścinają fragment tej ścieżki — klient widzi „płatność zakończona", choć webhook PayU nie dotarł albo zamówienie jest w `PENDING`. Konsekwencja: klient bez dostępu (irytacja) albo gorszy wariant — przekonanie, że zamówienie zaksięgowane, gdy nie jest.
- **[ROZWIĄZANIE]:** Po powrocie z PayU kasa NIE oznacza sukcesu z samego faktu powrotu — odpytuje funkcję serwerową o status zamówienia w bazie (np. `myAccount`/`orders` po `order_id` z sesji) z krótkim odpytywaniem (3× co 3 s), a widok „płatność przyjęta" pokazuje dopiero przy statusie `COMPLETED` z bazy; inaczej widok „płatność jest weryfikowana, potwierdzenie wyślemy mailem". Dostęp (Access) i tak przyznaje wyłącznie `fulfillOrder` po podpisanym webhooku — nie zmieniaj tej strony.

## W4 — Upload plików z przeglądarki przez SDK (powierzchnia dla użytkownika zalogowanego)
- **[POZIOM RYZYKA]: Średni** (do weryfikacji testem — patrz opis)
- **[LOKALIZACJA]:** `src/components/admin/ProductEditor.jsx`, `ProductAccessFields.jsx`, `events/form/StepCover.jsx`, `events/cover/coverKit.js`, `library/MaterialUpload.jsx`, `obok/RecordingUpload.jsx`, `course/LessonRow.jsx`, `podcast/GuestsTab.jsx` (bezpośrednie wywołania `integrations.Core.UploadPublicFile` / `UploadPrivateFile` z panelu).
- **[OPIS PROBLEMU]:** Wgrania robi przeglądarka sesją osoby klikającej. Panel jest admin-only, ale samo wywołanie integracji jest dostępne każdemu zalogowanemu użytkownikowi z narzędzi deweloperskich (ten sam endpoint SDK). Jeśli platforma nie ogranicza go do administratorów, zalogowany klient mógłby hostować w magazynie publicznym aplikacji własne pliki (nadużycie pojemności, treści pod domeną aplikacji). Nie zweryfikowałem zachowania platformy dla sesji zwykłego użytkownika — tego nie da się ustalić z kodu aplikacji.
- **[ROZWIĄZANIE]:** Test: zalogowany zwykły użytkownik, wywołanie `UploadPublicFile` z konsoli — jeśli dojdzie, przenieś wgrania za funkcję serwerową: funkcja „upload-asset" wymaga `requireAdmin`, sama wykonuje `base44.asServiceRole.integrations.Core.UploadPublicFile({file})` i zwraca adres; panel woła tę funkcję. Dodatkowo walidacja typu/rozmiaru po stronie funkcji (obrazy/PDF, np. ≤ 25 MB). Bez względu na wynik testu — dobra praktyka, bo scalą kontrolę w jednym miejscu.

## W5 — Okno czasowe statusu „wkrótce"/limitów miejsc między kasą a powrotem do płatności
- **[POZIOM RYZYKA]: Niski**
- **[LOKALIZACJA]:** `payuCreateOrder` (limit miejsc sprawdzany przy tworzeniu zamówienia), `shared/seats.ts` (30-min okno płatności w toku).
- **[OPIS PROBLEMU]:** Limit miejsc liczony jako sprzedane + płatności w toku z ostatnich 30 minut — poprawnie, ale kilka równoległych inicjacji płatności bez zapłaty rezerwuje miejsca na pół godziny (możliwość „zatkania" sprzedaży przez konkurenta/trolla: 20/h na IP, ale z rozproszonych IP więcej). Koszt niski, ale realny przy ograniczonych kohortach.
- **[ROZWIĄZANIE]:** Skrócić okno dla nienapływających płatności (np. 10 min dla `PENDING` bez żadnej aktywności) i dodać w `SpotkaniaTick`/`cronTick` zwalnianie miejsc po wygaśnięciu płatności w toku. Opcjonalnie limit 1 otwarta płatność na e-mail naraz.

## W6 — Odczyt obrazów prywatnej biblioteki bez uwierzytelnienia użytkownika
- **[POZIOM RYZYKA]: Niski** (środek już ograniczony; świadoma decyzja architektoniczna)
- **[LOKALIZACJA]:** `media` (proxy obrazów z prywatnej biblioteki).
- **[OPIS PROBLEMU]:** Obraz autoryzowany jest pochodzeniem żądania (same-origin / referer), losowym `pub_id` (32 hex) i limitem 300/min na IP — ale nie tożsamością sesji. Każdy, kto dostanie `pub_id` (np. z adresu obrazka w materiale), wyświetli go w kontekście aplikacji niezależnie od wykupionego dostępu. Ryzyko wycieku pojedynczego obrazu, nie serii.
- **[ROZWIĄZANIE]:** Jeśli treść biblioteki ma być twardo per-użytkownik: przy renderowaniu strony sprawdzać sesję i podpisywać `pub_id` krótkim podpisem (wzorzec już używany w `videoSign` — HMAC z kluczem aplikacji, 15 min), a `media` weryfikować podpis zamiast referera. Alternatywa: pozostawić jak jest i udokumentować, że obrazy są „słabo prywatne" (dziennik SecurityLog ma typ `wspoldzielenie` — można tam logować nietypowe odczyty).

## W7 — Kody podarunkowe/rabatowe zgadywalne przy słabszym formacie
- **[POZIOM RYZYKA]: Niski**
- **[LOKALIZACJA]:** `DiscountCode.code` (tworzony w panelu), `checkDiscount`.
- **[OPIS PROBLEMU]:** Karty podarunkowe mają losowy 24–64 znakowy token (`gift_token`) — dobrze. Ale zwykły `code` wpisuje człowiek (np. „START10") i podlega enumeracji słownikowej; limit 10/h na IP spowalnia, lecz z rozproszonego proxy odpowiednia lista kodów marketingowych (publikowanych w powiadomieniach — pole `w_powiadomieniach`) i tak jest osiągalna. Realny zysk atakującego mały (kod i tak ma być publiczny), ryzyko rośnie tylko przy kodach indywidualnych o dużej wartości.
- **[ROZWIĄZANIE]:** Dla kodów indywidualnych o wyższej wartości generować kody o długości ≥ 12 losowych znaków (funkcja w panelu), nigdy krótkie słowa; `max_uses` obowiązkowo ustawiany (patrz W2).

## W8 — Brak reguł RLS na wbudowanej encji User (świadome)
- **[POZIOM RYZYKA]: Niski / informacyjne**
- **[LOKALIZACJA]:** `base44/entities/User.jsonc`.
- **[OPIS PROBLEMU]:** Brak własnych reguł — ochronę zapewnia platforma (cudze konta tylko dla admina, klient nie tworzy ani nie usuwa rekordów). Zgodne z dokumentacją platformy; własne reguły mogłyby zderzyć się z wewnętrznymi zachowaniami platformy.
- **[ROZWIĄZANIE]:** Bez zmian. Nie dodawać własnych reguł RLS do User bez wyraźnej potrzeby.

---

# OBSZARY ZWERYFIKOWANE JAKO POPRAWNE (bez zaleceń)

- RLS 59 encji: dane klientów admin/właściciel, zapisy zamknięte, treści publiczne celowo (lista w sekcji 1).
- Panel admina: warstwa UI + `requireAdmin` serwerowo na każdej akcji; rola `techniczna` ograniczona do wybranych sekcji CMS.
- Sekrety: brak zahardkodowanych kluczy w `src/`; integracje wyłącznie serwerowe; `publicSettings` z białą listą pól (klucze PayU/SMTP nie wyciekają); klucze rezerwacji w sekretach środowiskowych.
- SQL: escapowanie `escStr`/`esc` (dollar-quoting z unikalnym ogranicznikiem), whitelisty liczb, stałe nazwy obiektów.
- XSS: wszystkie 24 punkty `dangerouslySetInnerHTML` sanitizowane; treści biblioteki sanitizowane serwerowo; React-escapowanie reszty.
- Rate limiting: wszystkie publiczne akcje z wysyłką maili / zapisem mają limity na IP; pole-pułapka na boty; fail-open tylko w licznikach (celowe).
- Płatności: ceny/limity/rabaty z bazy; webhook podpisany (`safeEqual`), idempotentny; dostęp przyznaje tylko fulfillment.
- Pliki: klient nie ma ścieżki uploadu; produkty/bilety prywatne z podpisami 1 h; okładki publiczne (marketing).
- Wyciek tożsamości: odpowiedzi publiczne bez danych osobowych (statusy po losowych numerach zamówienia, bilet/karta po losowych tokenach).

# CO WARTO URUCHOMIĆ (po naprawach)

1. W1 — trywialne, zamyka jedyny realny wyciek informacji.
2. W2 + W7 — zanim ruszy sprzedaż z kodami (obecnie PayU/Fakturownia nieskonfigurowane, więc niskie ryzyko na dziś).
3. W3 — razem z konfiguracją PayU.
4. W4 — test jednorazowy, potem decyzja o przeniesieniu uploadów.
5. Po naprawach: panel Bezpieczeństwo (skan platformy) + powtórka tego audytu przy okazji uruchomienia płatności.