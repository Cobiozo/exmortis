# Wyjście z Base44 — mapa zależności i plan (dla informatyka)

Cel: platforma działa dalej tak samo, a kod i dane są pod pełną kontrolą właściciela. Poniżej to, co dziś zapewnia Base44, czym to zastąpić i w jakiej kolejności.

**Nie migrować w oknie 28.10–2.11 (premiera 1.11, webinar 20:00).**

## 1. Co dokładnie zależy od Base44

| Element | Jak używany dziś | Skala | Zamiennik (propozycja) | Trudność |
|---|---|---|---|---|
| Hosting strony | Build Vite → hosting Base44 pod exmortis.pl | 1 SPA | Dowolny hosting statyczny z rewrite na `index.html` (Vercel, Netlify, Cloudflare Pages, nginx) | niska |
| Plugin `@base44/vite-plugin` | Build, alias `@/` | — | Zwykła konfiguracja Vite (`resolve.alias`) | niska |
| Funkcje serwera | 51 funkcji Deno, `createClientFromRequest(req)` | ok. 12,8 tys. linii (z `shared/`) | Supabase Edge Functions (też Deno) albo Deno Deploy / Node; podmiana klienta Base44 na adapter | średnia |
| Encje Base44 | 51 kolekcji, `base44.entities.X.list/filter/create/update`, także z przeglądarki (głównie panel) | ok. 130 wywołań | Tabele w Supabase Postgres (te same pola, `id`, `created_date`, `updated_date`) + RLS; adapter z tym samym API (`entities.X.filter(...)`) | średnia–wysoka |
| Logowanie | `base44.auth.*` (rejestracja z OTP, logowanie, Google, reset hasła, `me`, `updateMe`, `logout`), rola w `User.role` | ok. 50 wywołań | Supabase Auth (e-mail + OTP, Google). Hasła nie są przenoszalne → klienci ustawiają nowe przez „Nie pamiętam hasła” albo logują się linkiem | wysoka (wpływ na klientów) |
| Pliki | `integrations.Core.UploadPublicFile/UploadPrivateFile/CreateFileSignedUrl` | 15 miejsc + istniejące pliki | Supabase Storage (bucket publiczny + prywatny z podpisanymi linkami) albo S3/R2; skrypt kopiujący pliki i podmieniający adresy w danych | średnia |
| E-mail systemowy | `integrations.Core.SendEmail` (2 miejsca); reszta przez własny SMTP | małe | Wyłącznie SMTP (Brevo) — już jest | niska |
| Zadania cykliczne | 9 workflow (cron) wołających funkcje z `tick_token` | 9 | Cron Supabase (`pg_cron` + `net.http_post`), GitHub Actions albo cron na serwerze | niska |
| Łącznik Supabase | Token Management API przez OAuth Base44; `runSql` przez Management API, `rpc` przez PostgREST z kluczem service_role pobieranym w locie | wszystkie funkcje | Bezpośrednio: zmienna środowiskowa `SUPABASE_SERVICE_ROLE_KEY`, klient `postgres`/`supabase-js`; `runSql` → zwykłe zapytania (zachować `escStr` albo przejść na parametry) | niska–średnia |
| Łącznik Google Calendar | OAuth Base44 (`calendar.app.created`, `calendar.freebusy`) — rezerwacje 1:1 | 1 moduł | Własny klient OAuth Google (projekt w Google Cloud) | średnia |
| Łącznik Instagram | Feed na stronie | 1 funkcja | Instagram Graph API z własnym tokenem albo usunięcie | niska |
| Sekrety | `secrets.get("BOOKING_HMAC_KEY" / "BOOKING_ENC_KEY")` | 2 | Zmienne środowiskowe — **przenieść te same wartości** (inaczej zaszyfrowane odpowiedzi z rezerwacji będą nieczytelne) | niska |
| AI (obrazy ROZDROŻY) | `aiGateway` Base44 (opcjonalnie; jest też dostawca OpenAI z kluczem w panelu) | 1 | Tylko OpenAI (już zaimplementowane) | niska |
| Analityka / nagrania sesji Base44 | wyłączone | — | — | — |

Liczby wywołań: `grep -rn "base44\." src base44 | wc -l`. Szczegóły funkcji: FUNKCJE.md; encje: DANE_BASE44.md.

## 2. Zalecana kolejność (każdy krok osobno, z możliwością powrotu)

1. **Repozytorium i CI.** Kod w Git (GitHub właściciela). CI: `npm ci && npm run lint && npm run build` przy każdym pushu. Base44 umożliwia połączenie z GitHubem albo eksport kodu (Base44 → GitHub / „Export source code”).
2. **Kopia danych.** Eksport wszystkich encji Base44 do JSON (np. `base44 exec` z `--privileged`, albo funkcja eksportu), kopia plików ze storage, `pg_dump` Supabase. Przechowywać poza oboma dostawcami. Powtarzać przy każdym kroku.
3. **Adapter danych w kodzie (bez zmiany dostawcy).** Wprowadzić warstwę `src/api/` i `base44/shared/db.ts` z tym samym interfejsem co dziś (`entities.X.filter/list/create/update/delete`, `auth.me`, `files.upload/sign`). Wszystkie wywołania `base44.*` przez adapter. Na tym etapie adapter wciąż woła Base44 → zero zmian dla klientów, a później zmienia się tylko adapter.
4. **Encje → Supabase.** Tabela na encję (te same nazwy pól), skrypt kopiujący dane, przełączenie adaptera kolekcja po kolekcji (najpierw treści i konfiguracja, na końcu dostęp/licencje).
5. **Pliki → Supabase Storage / R2.** Skrypt kopiujący + podmiana adresów w danych (pola `*_url`, `*_uri`, `oryginal_uri`, `warianty`).
6. **Funkcje → Supabase Edge Functions (Deno).** Większość kodu przenosi się 1:1; podmienić `createClientFromRequest` na adapter, `secrets.get` na `Deno.env.get`, łącznik Supabase na klucz z env. Adresy `/functions/<nazwa>` zachować przez reverse proxy (PayU ma zapisany `https://exmortis.pl/functions/payuNotification`).
7. **Zadania cykliczne → pg_cron / cron serwera.** Te same adresy i tokeny.
8. **Logowanie → Supabase Auth.** Najtrudniejszy krok: import kont (e-mail, rola, imię), mapowanie identyfikatorów użytkownika w danych (`created_by`, `user_id`, e-maile w Access/License), komunikat do klientów o ustawieniu nowego hasła. Zrobić w spokojnym okresie, z mailem zapowiadającym.
9. **Hosting strony + DNS.** Nowy hosting statyczny, przełączenie rekordów A/CNAME w Simply (krótki TTL dzień wcześniej). Sprawdzić: przekierowania, `robots.txt`, mapę strony, nagłówki bezpieczeństwa, adres powrotu PayU i powiadomień.

## 3. Pułapki

- `escStr` + Management API: zapytania budowane tekstowo — przy przejściu na zwykły klient Postgres lepiej użyć zapytań z parametrami.
- Strefa czasowa: daty liczone w `Europe/Warsaw` po stronie serwera (`warsawToday`, `addDaysWarsaw`, harmonogram ROZDROŻY) — zachować.
- Tryb przedpremierowy i bramka `/konto` zależą od `app_settings.premiera` i zegara serwera.
- Linki w wysłanych mailach (potwierdzenia, `/dolacz?t=…`, `/listy/potwierdz`, `/rezerwacja/zarzadzaj`) muszą działać po migracji — nie zmieniać tras ani formatu tokenów.
- Podpisy wideo (`videoSign.ts`) i `stream.php` na serwerze Dawida — ten sam klucz.
- Obowiązki prawne: dowody zgód (Consent), wersje dokumentów (LegalDocVersion), odstąpienia (Withdrawal) i zamówienia trzeba przenieść w całości (nie czyścić).
- Funkcje SQL po stronie Supabase (lista w DANE_SUPABASE.md) są częścią logiki — migrują razem z bazą (`pg_dump` je obejmuje).
