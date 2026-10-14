# Faktury — automatyzacja Fakturownia

Dokument dla księgowości i dla osoby odpowiadającej za zgodność (RODO). Kod: `base44/shared/invoices.ts`,
panel: **Ustawienia → Faktury (Fakturownia)**, numer i link w **Zamówieniach**, ponowienia w zadaniu cyklicznym.

## Co system robi sam

- Po opłaceniu zamówienia (status COMPLETED, kwota > 0) wystawia fakturę VAT: data = dzień wystawienia,
  status „opłacona”, metoda płatności PayU, pozycje z nazwami produktów, rabat z kodu rozłożony na pozycje
  (suma dokumentu = zapłacona kwota).
- Karta podarunkowa jest wystawiana jako **bon różnego przeznaczenia** — pozycja z adnotacją „(bon)” i stawką „np”.
- Kupujący z NIP dostaje fakturę na dane firmowe (nazwa, NIP, adres rozłożony na ulicę/kod/miasto).
- Kupujący bez NIP — wg ustawienia: faktura VAT, faktura bez VAT (zwolniona) albo brak faktury.
- Zamówienia na 0 zł (karta pokryła całość) i zamówienia „FREE-” nie są fakturowane.
- Numer faktury i link do PDF: w koncie kupującego (Zamówienia → Pobierz fakturę) i w panelu (Zamówienia).
- Błąd Fakturowni nie przerywa zamówienia — komunikat widać przy zamówieniu, a przycisk „Wystaw ponownie”
  ponawia próbę. Zaległe zamówienia (10 minut – 7 dni po opłaceniu) dokończy zadanie cykliczne,
  maksymalnie 10 na przebieg, ten sam dokument najwyżej raz na 30 minut.
- Zwrot z panelu (po przyjęciu przez PayU) wystawia fakturę korygującą do kwoty zwrotu — o ile oryginalna
  faktura istnieje. Numer korekty jest zapisany przy zwrocie (kolumny `correction_*` w `order_refunds`).

## Lista dla księgowości

| # | Do zrobienia | Gdzie |
|---|---|---|
| 1 | Wklej token API Fakturowni (Ustawienia → API) jako sekret aplikacji `FAKTUROWNIA_API_TOKEN`; podaj nazwę konta (subdomena) i włącz automatyczne faktury. | Ustawienia → Faktury (Fakturownia) |
| 2 | Ustaw domyślną stawkę VAT oraz stawkę dla treści cyfrowych (e-book, audio, wideo, kurs). Domyślnie obie idą jedną stawką — potwierdź, czy treści cyfrowe mają własną. | Ustawienia → Faktury (Fakturownia) |
| 3 | Potwierdź, że pozycja „(bon)” ze stawką „np” dla kart podarunkowych jest zgodna z przyjętym sposobem rozliczania bonów różnego przeznaczenia. | Ustawienia → Faktury (Fakturownia) |
| 4 | Potwierdź ustawienie dla kupujących bez NIP: faktura VAT, faktura bez VAT (zwolniona) czy brak faktury. Faktura „bez VAT” wystawiana jest jako dokument ze stawką „zw” — sprawdź, czy podstawa zwolnienia jest wpisana w ustawieniach konta Fakturowni. | Ustawienia → Faktury (Fakturownia) |
| 5 | Sprawdź adresy firmowe: adres z kasy to jedna linia, system rozkłada go po kodzie pocztowym (00-000). Zamówienia z nietypowym zapisem adresu obejrzyj ręcznie. | Zamówienia → szczegóły zamówienia |
| 6 | Sprawdź pierwszą korektę do zwrotu (częściowy zwrot): pozycja korygująca powstaje jako jedna linia z „przed / po”, a nie jako korekta wszystkich pozycji oryginału. Jeśli Fakturownia ma to liczyć inaczej — zgłoś, poprawimy model korekty. | Zamówienia → szczegóły zamówienia → Zwroty |
| 7 | Nadaj pracownikowi, który ma wystawiać faktury ręcznie, rolę administratora — inaczej nie zobaczy sekcji faktur i przycisku ponowienia. | Ustawienia → Faktury / Zamówienia |
| 8 | Ustal, czy Fakturownia ma wysyłać dokument na e-mail kupującego (przełącznik „Wyślij dokument e-mailem”). Wyłączone = faktura tylko do pobrania z konta i panelu. | Ustawienia → Faktury (Fakturownia) |
| 9 | Sprawdź eksport CSV dla księgowości (Zamówienia → CSV) — zawiera dane do faktury i znacznik wystawienia; numer z Fakturowni jest w panelu i w koncie kupującego. | Zamówienia |
| 10 | Raz w miesiącu przejrzyj zamówienia opłacone bez numeru faktury (filtr „Tylko faktury do wystawienia”) i wyjaśnij te z błędem. | Zamówienia |

## Lista dla prawnika / RODO

| # | Do potwierdzenia | Gdzie |
|---|---|---|
| 1 | Faktury są dokumentami księgowymi — przy usunięciu konta zostają (obowiązek podatkowy). Usunięcie danych osobowych nie usuwa wiersza zamówienia ani numeru faktury. | Polityka prywatności → okres przechowywania |
| 2 | Dane do faktury (nazwa firmy, NIP, adres) są przetwarzane na podstawie obowiązku podatkowego, nie zgody — sprawdź, czy Polityka prywatności wymienia tę podstawę osobno. | Polityka prywatności |
| 3 | Eksport danych osoby (RODO) zawiera numer faktury i link do dokumentu — potwierdź, że link do PDF (token Fakturowni) może być wydany osobie, której dane dotyczą. | Polityka prywatności / eksport danych |
| 4 | Link do faktury jest dostępny bez logowania (token Fakturowni). Widzi go wyłącznie kupujący (własne zamówienie) i administrator — potwierdź, że taki sposób udostępniania jest akceptowany. | Zamówienia / konto kupującego |
| 5 | Token API Fakturowni jest sekretem aplikacji (nie w bazie, nie w ustawieniach) — dostęp ma wyłącznie serwer. Potwierdź, kto w firmie zarządza tym sekretem. | Sekrety aplikacji |
| 6 | Dokumenty wystawia Fakturownia jako podmiot przetwarzający; sprawdź, czy umowa powierzenia z Fakturownią jest podpisana i aktualna. | Umowy z dostawcami |
| 7 | Faktura bez VAT (zwolniona) wymaga podstawy zwolnienia — potwierdź, czy korzystasz ze zwolnienia podmiotowego i czy opis na dokumencie jest wystarczający. | Ustawienia → Faktury / Fakturownia |
| 8 | Wysyłka dokumentu e-mailem z Fakturowni to odrębny od nas kanał — potwierdź, że adres kupującego może być w tym celu przekazany do Fakturowni. | Umowa powierzenia / Polityka prywatności |
| 9 | Kupujący nie dostaje faktury, jeśli sam jej nie zażądał — potwierdź, że wystawianie dokumentu na każde opłacone zamówienie jest zgodne z przyjętą praktyką. | Ustawienia → Faktury (Fakturownia) |
| 10 | Korekty do zwrotów zawierają kwotę zwrotu i numer oryginalnej faktury — potwierdź, że zakres danych na korekcie jest zgodny z wymogami. | Fakturownia |