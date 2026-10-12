# Audyt całej aplikacji — 12.10.2026

Zakres: wszystkie publiczne strony (29 adresów, crawl po linkach) na 375 px i 1366 px, 24 sekcje panelu admina na 375 px i 1366 px (bez danych — podgląd układu), cele dotyku na telefonie, tytuły kart, ścieżka zakupu w Skarbcu.
Metoda: Playwright + Chromium w sandboxie, lokalny build z bieżącego kodu, żądania /api przekierowane na exmortis.pl, tryb przedpremierowy wyłączony tylko w przeglądarce testowej.

## Wynik
- Poziomy scroll: brak na żadnej stronie publicznej i w żadnej sekcji panelu (375 i 1366).
- Błędy konsoli: tylko oczekiwane (401 `User/me` dla gościa, 404 rezerwacji przy wyłączonym module).
- Zepsute obrazy: brak.

## Naprawione
### Sprzedaż (Skarbiec)
- Produkty „wkrótce” na stronie produktu miały przycisk koszyka — teraz zapis na listę oczekujących (jak na karcie w Skarbcu).
- Serwer (`payuCreateOrder`) odrzuca produkty „wkrótce”, ukryte i darmowe.
- Cena promocyjna: Skarbiec pokazywał 77 zł („Wracam inny” do 31.10), a kasa liczyła 97 zł. Teraz jedna reguła ceny dla karty, strony produktu, koszyka i serwera (`src/lib/productPrice.js`, `base44/shared/productPrice.ts`), promocja do końca dnia czasu polskiego.
- Produkt „po rozmowie” (POWRÓT — mentoring, cena 0, niedarmowy) nie trafia do koszyka; przycisk prowadzi do linku produktu.
- Darmowe produkty z własnym linkiem (Listy, test, cisza, podcast, WhatsApp) na stronie produktu mają przycisk do tego linku zamiast koszyka 0 zł.
- Stopka Skarbca: „REGULAMIN” i „POLITYKA ZWROTÓW” prowadziły do `#` — teraz /regulamin i /odstapienie.
- Strona produktu bez zdjęcia: znak exmortis zamiast pustego pola, niższe pole na telefonie.
- Przyciski +/− ilości: etykiety dla czytników ekranu, maksymalnie 20 sztuk (jak na serwerze).

### Panel
- Kafelki w czterech grupach z numeracją ciągłą (ukryte moduły nie zostawiają luk). Nowe kafelki: Menu i stopka, Historia zmian. Kafelek „Podgląd strony” wyrównany jak pozostałe.

### Telefon
- Stopka, spis treści dokumentów prawnych, okruszki „← Sklep”, „Nie pamiętam hasła”, „Obserwuj”, przycisk TEST: większe pole dotyku bez zmiany wyglądu.
- Pola wyboru w formularzach publicznych 20 px (kasa, rejestracja, zgody, podcast, cisza, Obok, lista oczekujących, test).
- Nagłówek stron CMS bez zdjęcia w tle (np. Kontakt) — na telefonie bez pustego ekranu nad tytułem.

### Teksty i SEO
- Odzyskiwanie i ustawianie hasła: etykiety były po angielsku — teraz po polsku. „Zamknij”/„Poprzedni slajd” dla czytników ekranu.
- Tytuły kart: produkt, spotkanie, logowanie, rejestracja, hasło, konto, kasa, dołączanie, rezerwacja, 404.

## Do decyzji / treści (poza kodem)
- Karta podarunkowa: „on wybierze” → np. „ta osoba wybierze” (zasada neutralności). Opcjonalnie „Dla każdego, kto…” → „Dla każdej osoby, która…” (Listy powrotu, Wracam inny).
- Nazwy produktów z cudzysłowem zamkniętym apostrofem lub prostym: „Wracam inny', „30 dni ciszy', „Cztery etapy powrotu', „Próg', „Bieszczady…', Audiobook — poprawnie „…”.
- Karta podarunkowa ma kategorię „ebook”.
- Promocja z przekreśloną ceną: przepisy (Omnibus) wymagają podania najniższej ceny z 30 dni przed obniżką — do decyzji prawnej.

## Etap 2 — kasa i płatności (przed sprzedażą od 16.11)
Testy: funkcje płatności uruchomione lokalnie (Deno) z atrapą bazy i PayU; kasa w przeglądarce z atrapą odpowiedzi.

### Naprawione
- Powiadomienia PayU: pierwsze COMPLETED przejmowane atomowo (UPDATE … RETURNING) — równoległe i ponowione powiadomienia nie dublują dostępu, maili ani pakietu sesji. Wcześniej: dwa COMPLETED naraz = dwa razy wydłużony dostęp i dwa maile.
- Spóźnione PENDING nie cofa już COMPLETED/CANCELED (wcześniej cofało i kolejne COMPLETED nadawało dostęp drugi raz).
- Błąd przy nadawaniu dostępu cofa przejęcie i zwraca 500 → PayU ponawia; nadawanie dostępu idempotentne po numerze zamówienia.
- Podpis PayU: obsługa MD5, SHA-1 i SHA-256 (wg nagłówka).
- Kod rabatowy zużywany dopiero po opłaceniu (porzucona płatność nie zabiera użycia). Podgląd rabatu liczy od ceny promocyjnej, jak kasa.
- Kasa przy niedziałającym PayU pokazywała „Przyjęte — dostęp wyślę mailem” i czyściła koszyk, choć zamówienie nie powstawało. Teraz jasny komunikat, koszyk zostaje.
- Powrót z PayU: strona sprawdza stan zamówienia (do 60 s); przerwana/odrzucona płatność = „Płatność nie doszła do skutku” + powrót do kasy z koszykiem. Koszyk czyszczony dopiero po potwierdzeniu.
- Kasa odświeża ceny i dostępność przy wejściu (koniec promocji, produkt „wkrótce”) i informuje o zmianie. Ilość maks. 20 jak na serwerze.
- Mail potwierdzenia: numer zamówienia, kwoty w formacie „77,00 zł”, linki do Regulaminu i formularza odstąpienia, zabezpieczenie imienia/nazw przed wstrzyknięciem HTML. Usunięte „wyślę w kolejnej wiadomości” (dostęp jest w tym samym mailu).
- Mail do prowadzącego o każdym opłaconym zamówieniu (adres z Danych firmy / SMTP).
- Formularz odstąpienia: limit 5 zgłoszeń/h z jednego IP (ochrona przed wysyłką potwierdzeń na cudze adresy), bez blokowania przy błędzie technicznym. Nowy typ „odstapienie” w SecurityLog.
- Koszyk: większe przyciski +/−/usuń z etykietami.

### Do decyzji (Dawid / księgowość)
- Faktury: aplikacja ich nie wystawia ani nie zbiera NIP. Do ustalenia z księgową (KSeF, faktura na żądanie), ewentualnie pole „NIP do faktury” w kasie.
- PayU: klucze produkcyjne + test w sandboxie przed 16.11 (adres powiadomień: https://exmortis.pl/functions/payuNotification).

## Etap 3 — faktury, panel zamówień, kursy wideo
- Kasa: „Potrzebuję faktury na firmę (NIP)” — nazwa firmy, NIP (suma kontrolna w przeglądarce i na serwerze), adres. Dane w zamówieniu (kolumna `invoice`, zakładana przy pierwszym zamówieniu z fakturą) i w notatce; w mailu do klienta i do prowadzącego.
- Panel → Zamówienia (nowy kafelek w „Sklep i treści”): przychód w miesiącu, opłacone, faktury do wystawienia; filtry (status, „tylko faktury do wystawienia”), wyszukiwarka, szczegóły zamówienia, „Oznacz jako wystawioną” z numerem faktury, eksport CSV dla księgowości (Excel, średnik). SQL sprawdzony na Postgresie (PGlite) — także zanim powstanie kolumna invoice.
- Kursy wideo: kupujący dostaje dostęp po płatności (Moje konto → Moje produkty → Otwórz kurs) — sprawdzone. Nowe:
  - lekcja może mieć wideo z adresu: własny serwer (mp4/webm, domena z listy „Ustawienia strony → Biblioteka”), Vimeo, YouTube, Bunny — pliki w aplikacji mają limit 100 MB, kursy zwykle więcej;
  - pasek postępu kursu, data końca dostępu, przycisk „Dalej: następna lekcja”, poprawka szerokości odtwarzacza na telefonie;
  - program kursu (moduły, lekcje, czas) na stronie produktu w Skarbcu;
  - w panelu podpowiedzi przy lekcjach, licznik widocznych lekcji, usuwanie wgranego pliku.
- Mail po zakupie dla nowego konta: jak wejść (Google albo „Nie pamiętam hasła”). Moje konto → Zakupy: numer zamówienia.
