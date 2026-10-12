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
