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
| Zadania cykliczne | 9 workflow (cron) wołających funkcje z `tick_token` | 9 | Cron Supabase (`pg_cron` + `net.http_post`) | niska |
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

### Krok 8 — stan po przygotowaniu (2026-10-22)

Gotowe i nieszkodliwe na obecnym hostingu:
- `src/api/exmAuth.js` — logowanie na Supabase Auth z tym samym API co `base44.auth`
  (register, OTP, login, Google, reset hasła, `me`, `updateMe`, `logout`). Sesja w
  localStorage (`exm_supa_session`); linki z maili Supabase (sesja w `#hash`) są
  przechwytywane przy starcie; strona `/reset-password` obsługuje oba formaty linków.
- Adapter (`src/api/exmAdapter.js`) przełącza logowanie jedną zmienną:
  `VITE_EXM_AUTH_BACKEND=supabase` (dziś: `base44` — na platformie zapisy i funkcje
  identyfikują użytkownika po sesji platformy, więc przełączenie bez przenoszenia
  hostingu odcina zapisy).
- Konto administratora utworzone w Supabase Auth (potwierdzone); hasło ustawia się
  przez „Nie pamiętam hasła” (mail poszedł na adres konta). Konta skopiowane do
  tabeli `exm_user` (reguła RLS: tylko własny wiersz po adresie z sesji).
- Adresy powrotów Supabase: `site_url=https://exmortis.pl`, lista: exmortis.pl,
  podgląd na base44.app, localhost:5173.

Do zrobienia przy przełączeniu (razem z krokami 5–7 i 9):
1. ✅ Zrobione 2026-10-22: logowanie przełączone na Supabase (domyślnie, gdy skonfigurowany;
   powrót zmienną `VITE_EXM_AUTH_BACKEND=base44`); AuthContext sprawdza sesję zawsze,
   gość zostaje na stronie publicznej (chronione strony pilnuje ProtectedRoute).
2. ✅ Kont: konto jest jedno (administratora) — już w Supabase Auth i `exm_user`;
   przy większej liczbie kont: `POST /auth/v1/admin/users` (service key) + wiersz `exm_user`.
3. ⚠️ Szablony maili Supabase: plan darmowy z domyślną pocztą ich nie pozwala zmienić —
   maile są po angielsku i zawierają LINK (nie kod). Strona rejestracji przerobiona na
   link: link wraca na /register, sesja jest w adresie i zgody dokańczają się same.
   Po konfiguracji SMTP i wyższym planie można wrócić na kody (szablony z `{{ .Token }}`).
4. Provider Google w Supabase (Configure → Authentication) + adresy powrotu na liście —
   do zrobienia, dopóki go nie ma przycisk Google w logowaniu nie zadziała.
5. SMTP w Supabase (Brevo) zamiast wbudowanej poczty — limity testowej są niskie
   (kilka maili na godzinę); konfiguracja SMTP odblokuje też własne szablony.
6. Hasła nie są przenoszonalne — klienci ustawiają nowe przez „Nie pamiętam hasła”.
9. **Hosting strony + DNS (cyberfolks.pl).** Build statyczny (`npm run build` → `dist/`) serwuje aplikacja Node.js `server.js` z katalogu głównego repo (Passenger, port z `PORT`, SPA-fallback na `index.html`, brak cache dla `sw.js`/manifestu). Uruchomienie w panelu cyberfolks: aplikacja Node.js, katalog główny repo, `npm install`, start: `node server.js`. Połączenie z backendem wyłącznie przez `.env` (VITE_SUPABASE_URL + klucz anon — klucz publiczny, chroni go RLS). Przełączenie rekordów A/CNAME w Simply (krótki TTL dzień wcześniej). Sprawdzić: przekierowania, `robots.txt`, mapę strony, nagłówki bezpieczeństwa, adres powrotu PayU i powiadomień.

## 3. Pułapki

- `escStr` + Management API: zapytania budowane tekstowo — przy przejściu na zwykły klient Postgres lepiej użyć zapytań z parametrami.
- Strefa czasowa: daty liczone w `Europe/Warsaw` po stronie serwera (`warsawToday`, `addDaysWarsaw`, harmonogram ROZDROŻY) — zachować.
- Tryb przedpremierowy i bramka `/konto` zależą od `app_settings.premiera` i zegara serwera.
- Linki w wysłanych mailach (potwierdzenia, `/dolacz?t=…`, `/listy/potwierdz`, `/rezerwacja/zarzadzaj`) muszą działać po migracji — nie zmieniać tras ani formatu tokenów.
- Podpisy wideo (`videoSign.ts`) i `stream.php` na serwerze Dawida — ten sam klucz.
- Obowiązki prawne: dowody zgód (Consent), wersje dokumentów (LegalDocVersion), odstąpienia (Withdrawal) i zamówienia trzeba przenieść w całości (nie czyścić).
- Funkcje SQL po stronie Supabase (lista w DANE_SUPABASE.md) są częścią logiki — migrują razem z bazą (`pg_dump` je obejmuje).

## Krok 6 — zestaw migracyjny (2026-10-22)

W repo leży wygenerowany katalog `supabase/functions/` — wszystkie 51 funkcji i 75 modułów
wspólnych w formacie Supabase Edge Functions (Deno.serve + CORS). Zawartość:

- `_shared/compat.ts` — zamiennik `@base44/sdk`: auth.me z tokenu Supabase Auth + profil
  z `exm_user`, encje na PostgREST (tabele `exm_*`, jsonb `data`), integracje Core
  (maile: SMTP, pliki: Storage, obrazy: OpenAI), `users.inviteUser`, `functions.invoke`.
- `_shared/supabase.ts` — natywny runSql (npm:pg, `SUPABASE_DB_URL`), restGet/restCount/rpc.
- `_shared/shim.ts` — zamiennik `base44:runtime` (secrets, waitUntil).
- `docs/tech/migruj.mjs` — generuje katalog z `base44/` (uruchomić po każdej zmianie w funkcjach).

Do dokończenia:
1. Sekrety w Supabase (Dashboard → Edge Functions → Secrets): `OPENAI_API_KEY`,
   `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS`, `BOOKING_ENC_KEY`, `BOOKING_HMAC_KEY`
   (te same wartości co w Base44 — zaszyfrowane rezerwacje muszą się odszyfrować).
   `SUPABASE_DB_URL` wstrzykuje runtime; `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` też.
2. Buckety Storage: `private` i `public` + migracja plików (krok 5 planu).
3. Wdrożenie: lokalnie z komputera — `npx supabase login`, `npx supabase link --project-ref fqhvxhnbeyvwubpnuzxe`,
   `npx supabase functions deploy`. Token (`supabase access-token`) zostaje tylko na swoim dysku, w GitHubie NIE ustawiamy żadnych sekretów.
4. Ręczna decyzja: `adminDashboard` (googlecalendar), `instagramFeed` (instagram),
   `rozdrozaAdmin` (aiGateway) — łączniki Base44 nie istnieją na Supabase; tokeny do sekretów.
5. Crony: pg_cron/net.http_post z apikey = service_role, adresy `…/functions/v1/<nazwa>`.
6. Po wdrożeniu: frontend — adapter przestaje wołać Base44 (dopiero wtedy usuwamy
   `VITE_BASE44_*` z `.env`).