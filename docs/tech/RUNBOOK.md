# Runbook — obsługa na co dzień i w razie awarii

## 1. Praca z kodem bez edytora Base44

```bash
npm i -g base44            # CLI Base44 (wymaga Node 20+)
base44 login               # logowanie kontem właściciela/edytora aplikacji
base44 eject --app-id 6aa08bc6318b0f886cc3b9a3   # pobranie kodu (jeśli nie ma go jeszcze lokalnie)
npm ci
npm run dev                # strona lokalnie (funkcje i dane z Base44)
npm run lint && npm run build
base44 deploy              # publikacja: strona + funkcje + encje + workflow
```

- Zawsze przed publikacją: `npm run lint` i `npm run build` bez błędów.
- Zmiany schematów encji (`base44/entities/*.jsonc`) publikują się razem z `base44 deploy`; pola dodawać, nie usuwać (stare dane zostają).
- Zmiany w tabelach Supabase: przez pliki *Schema.ts / *Sql.ts (idempotentne `CREATE … IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`) albo w panelu Supabase — i dopisać do repozytorium.
- Okno zamrożenia 28.10–2.11: bez zmian w działających funkcjach.

## 2. Codziennie / co tydzień (Dawid)

- Panel → Pulpit: zapisy, faktury do wystawienia, brak linku Zoom (ostrzeżenie 48 h przed spotkaniem).
- Panel → Ustawienia strony → Wysyłka e-mail: status SMTP i kolejka zaległych maili (bez działającego SMTP maile czekają w kolejce).
- Panel → Bezpieczeństwo: błędy w przeglądarkach klientów (ClientError), zablokowane IP.
- Panel → Zamówienia: oznaczanie wystawionych faktur.

## 3. Najczęstsze problemy

| Objaw | Gdzie sprawdzić | Co zrobić |
|---|---|---|
| Klienci nie dostają maili | Panel → Wysyłka e-mail (status, dziennik); DNS (DKIM/SPF Brevo przy DMARC `p=reject`) | Naprawić SMTP, potem „Wyślij zaległe” z kolejki |
| Płatność opłacona, brak dostępu | Panel → Zamówienia (status); logi funkcji `payuNotification` (Base44 → Functions → Logs) | PayU ponawia powiadomienia; w razie potrzeby ręczne nadanie w Panel → Klienci i dostępy |
| Klient nie widzi /konto | Tryb przedpremierowy do 1.11, 21:30 (`app_settings.premiera`) | Po premierze samo się wyłącza; wyjątki: lista adresów z dostępem w ustawieniach |
| Strona wolno się otwiera po publikacji | Pierwsze wywołanie funkcji po wdrożeniu (zimny start) | Rozgrzewanie co 5 min robi to samo; poczekać 1–2 min |
| Film kursu się nie odtwarza | Panel → Ustawienia strony → Ochrona filmów (test), `stream.php` na serwerze | Sprawdzić klucz i datę serwera; domena w liście dozwolonych |
| Zadanie cykliczne nie działa | Base44 → Workflows (historia uruchomień) | Sprawdzić token w pliku workflow vs. funkcja |

## 4. Kopie zapasowe

- Supabase: kopie dzienne planu Supabase + co miesiąc ręczny `pg_dump` przechowywany poza Supabase.
- Base44: punkty przywracania kodu (checkpointy) + punkty danych (Base44 → Data → wersje). Przed większą zmianą: eksport encji do JSON.
- Pliki płatne (PDF, audio) i filmy: oryginały u Dawida + serwer wideo.

## 5. Kontakt z zewnętrznymi usługami

| Usługa | Do czego | Gdzie ustawienia |
|---|---|---|
| Simply.com | domena, DNS, poczta @exmortis.pl | panel Simply |
| Base44 | hosting, funkcje, baza, logowanie | app 6aa08bc6318b0f886cc3b9a3 |
| Supabase | baza Postgres (fqhvxhnbeyvwubpnuzxe) | panel Supabase |
| PayU | płatności | Panel → Ustawienia strony → PayU (klucze), w PayU adres powiadomień `https://exmortis.pl/functions/payuNotification` |
| Brevo (planowane) | wysyłka maili | Panel → Wysyłka e-mail |
| Zoom | spotkania online | Ustawienia strony → Mój stały link |
| Google Cloud / Calendar | rezerwacje 1:1 | łącznik Base44 |
| Serwer wideo Dawida | filmy kursów, nagrania | Ustawienia strony → Ochrona filmów |
