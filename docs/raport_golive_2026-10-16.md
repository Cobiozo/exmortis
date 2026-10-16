# Raport Go-Live — exmortis (2026-10-16)

Rola: Tech Lead / QA / Architekt Bezpieczeństwa. Zakres: 53 encje, 63 funkcje serwerowe, 10 workflowów, wszystkie trasy i przepływy frontendu. Bez zmian w kodzie i danych — tylko raport.
Metoda: skan reguł RLS wszystkich encji, wywołania testowe kluczowych funkcji (eventsPublic, rozdroza, media), przegląd stanu workflowów i danych produkcyjnych, heurystyczne skany frontendu i backendu, platforma (stan publikacji, skan bezpieczeństwa, SEO).

---

## 🔴 KRYTYCZNE (blokery przed publikacją)

1. **SMTP — maile nie wychodzą.** `MailQueue`: 3 wpisy z błędem „535 5.7.8 authentication failed" (simply.com). Poprzedni test: „Wysyłka e-mail nie jest skonfigurowana".
   *Skutek:* każda obietnica mailowa jest martwa — potwierdzenia zamówień i zapisów, przypomnienia o spotkaniach, kontakt, powrót z płatności (widok „w weryfikacji… potwierdzenie mailem" nigdy nie dojdzie).
   *Fix:* poprawne dane SMTP w panelu (Sekrety/ustawienia mail) + wykonanie testu wysyłki w panelu Maile. Bez tego NIE otwieraj sprzedaży.

2. **PayU nieskonfigurowane.** Kasa zwraca „Płatności online jeszcze nie działają" (komunikat jest poprawny i uczciwy — nic nie jest pobierane), ale sprzedaż nie działa.
   *Fix:* konfiguracja PayU w ustawieniach + test płatności 0,01 zł / darmowe zamówienie.

3. **Fakturownia — brak tokena.** Faktury do zamówień nie wystawią się automatycznie.
   *Fix:* token w panelu Sekrety + konfiguracja danych firmy.

4. **Skan bezpieczeństwa: 16 otwartych ustaleń, w tym 1 krytyczne („Potential hardcoded secret").** Ręczny skan bazy kodu (funkcje + shared + frontend) NIE wykazał żadnego zahardkodowanego sekretu — prawdopodobnie fałszywy alarm skanera (stałe kryptograficzne/domeny podpisów).
   *Fix:* przeglądnij ustalenia w panelu Bezpieczeństwo i odrzuć fałszywe, popraw potwierdzone; po publikacji uruchom skan ponownie (obecny jest przestarzały).

5. **Niezpublikowane zmiany.** Edytor ma zmiany, których nie ma na produkcji (m.in. naprawy audytu W1–W6 z wczoraj i dzisiejszego dnia).
   *Fix:* publikacja przez przycisk Publikuj — dopiero PO naprawie punktów 1–3.

## 🟠 WAŻNE (UX, stany brzegowe, do weryfikacji)

1. **Spotkanie „Wieczór powrotu" (3 XII) bez linku Zoom** — strona /dolacz i fallback pokażą spotkanie bez możliwości wejścia. Dodaj link Zoom przed 1 XII.
2. **Dane spotkania „Ze śmierci…" (1 XI) niekompletne:** `description: null`, brak okładki — widać na stronie i w podglądach OG/social. Uzupełnij opis i cover.
3. **W4 (audyt) — upload plików z sesji zwykłego użytkownika** nadal nieprzetestowany. Jeden test z konsoli zwykłego konta; jeśli przejdzie — przenieś wgrania za funkcję serwerową z `requireAdmin`.
4. **Rabaty w kasie / Safari prywatny** — podwójna ochrona jest (weryfikacja statusu z serwera, rezerwacja kodów atomowa), ale nie było jednego testu e2e kasy z kodem. Zrobić test po konfiguracji PayU (razem z pkt 🔴2).
5. **ROZDROŻA — kontrola dostępu:** funkcja `rozdroza` egzekwuje dostęp do konta i podpisuje media HMAC-em, ale nie było pełnego testu ścieżki „klient bez zakupu → próba odczytu". Zweryfikować ręcznie po publikacji.
6. **SEO: 67/100 (D)** — 1 niezaliczony test i 14 ostrzeżeń. Przejrzeć panel Marketing → SEO checklist przed Go-Live (bezpośrednio wpływa na widoczność premiery).
7. **Produkt „Rozmowa na progu"** nie istnieje już w encji Product (6 aktywnych produktów, wszystkie kompletne) — jeśli miała być linkowana gdziekolwiek, sprawdź czy nie został martwy link.

## 🟡 KOSMETYCZNE

1. **`server.js`: 9× `console.log`** — celowe logi startowe Passenger (bez danych wrażliwych). Zostawić.
2. **MailQueue: 3 rekordy z błędem (testy SMTP)** — po naprawie SMTP można je oznaczyć/usunąć z panelu, by nie zaśmiecały logu.
3. **Stare workflowy (SpotkaniaTick, BibliotekaTick, RezerwacjePowiadomienia, CmsZaplanowane, ZmianaAdresuTick, Rozgrzewanie) są nieaktywne — TO JEST CORAZ** — ich zadania przejmuje aktywny `ZadaniaCykliczne` (działa co 5 min, ostatnie przebiegi OK, koszt 6× niższy). Nie włączać ich ponownie; docelowo zarchiwizować dla przejrzystości.
4. **DolaczSzczyt i RozgrzewanieSzczyt: aktywne, ale nigdy nie uruchomione** — sprawdź, czy ich okna czasowe (szczyty) są ustawione i zamierzone; w przeciwnym razie wyłącz.
5. **Brak publicznych stron CMS poza „home"** — strony `_produkt`/`_spotkanie`/`_odcinek` mają gotowe szablony wbudowane (PAGE_DEFAULTS), więc szczegóły renderują się poprawnie; opcjonalnie opublikować własne wersje z edytora.

---

## CO ZWERYFIKOWANO JAKO POPRAWNE

- **RLS 53 encji:** otwarte odczyty tylko dla treści publicznych (PublishedPage, SiteNav, LegalDocVersion, PageRedirect, PodcastSettings, SilenceSettings, Utwor) — celowe; każdy zapis zamknięty (admin/techniczna). Dane klientów: właściciel/admin.
- **Panel admina:** podwójna warstwa — UI + `requireAdmin` serwerowo na każdej akcji.
- **Sekrety:** zero zahardkodowanych kluczy w `src/` i `base44/` (skan potwierdzony); integracje wyłącznie serwerowe.
- **Formularze (kontakt, powrót, rejestracja, podcast, newsletter, odstąpienie, booking, kasa):** wszystkie mają blokadę podwójnego wysłania (disabled + stan wysyłania) i komunikat przyjęcia/błędu w interfejsie.
- **Stany brzegowe konta:** moduły (produkty, zamówienia, biblioteka, sesje, bilety, wiadomości) mają ładowanie / pusty stan / błąd z ponowieniem — potwierdzone wcześniejszymi audytami modułowymi.
- **Przepływy bez ślepych zaułków:** wszystkie trasy zarejestrowane (w tym 4 strony logowania), redirecty starego sklepu, `/dolacz` z danymi awaryjnymi, strona 404 z treścią.
- **Wydajność:** zero wywołań `.list()` bez stronicowania w frontendzie; liczniki i sumy przez `count`/`aggregate` na serwerze; kursorowe „wczytaj więcej"; cache 20 s ROZDROŻA; koda Awaryjna: poprzednie audyty wydajności (PageSpeed) wykonane ręcznie.
- **Automatyzacja:** `ZadaniaCykliczne` aktywny i zdrowy (przebiegi co 5 min, ostatni 11:20), `RezerwacjeTick` aktywny.
- **Dane produktów:** 6 aktywnych produktów, wszystkie z ceną, opisem, okładką, kategoriami i limitami miejsc — wcześniejszy problem „brak okładek/opisów" został rozwiązany.
- **Kody rabatowe:** 3 aktywne, żaden nie wycieka do powiadomień bez flagi; rezerwacja atomowa przy zamówieniu.

---

## OCENA GOTOWOŚCI: 7 / 10

Kod, dane i zabezpieczenia: poziom wysoki i spójny (prior audits + dzisiejsza weryfikacja). Blokery są ale nie w kodzie: **maile (SMTP), płatności (PayU) i faktury (Fakturownia)** — trzy fundamenty, bez których objęcie sprzedaży jest przedwczesne, plus przegląd skanu bezpieczeństwa i publikacja zmian. Po wykonaniu 🔴1–5 i teście e2e kasy z kodem rabatowym: gotowa do startu (wtedy ocena 9/10).