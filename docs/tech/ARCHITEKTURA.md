# exmortis.pl — architektura (stan: 12.10.2026)

Dokument dla informatyka przejmującego platformę. Opisuje, co gdzie działa, od czego zależy i gdzie szukać kodu. Szczegóły generowane z kodu: [FUNKCJE.md](FUNKCJE.md), [DANE_BASE44.md](DANE_BASE44.md), [DANE_SUPABASE.md](DANE_SUPABASE.md), [ZADANIA_CYKLICZNE.md](ZADANIA_CYKLICZNE.md). Plan wyjścia z Base44: [MIGRACJA.md](MIGRACJA.md). Obsługa na co dzień: [RUNBOOK.md](RUNBOOK.md).

## 1. W skrócie

| Warstwa | Technologia | Gdzie |
|---|---|---|
| Strona (frontend) | React 18 + Vite + Tailwind 3 + react-router 6, SPA | `src/`, build → `dist/`, hosting Base44 (domena exmortis.pl) |
| Funkcje serwera | Deno (TypeScript), 51 funkcji HTTP | `base44/functions/<nazwa>/entry.ts`, wspólne: `base44/shared/` |
| Baza 1 | Base44 Entities (dokumentowa, 51 kolekcji) | schematy `base44/entities/*.jsonc` |
| Baza 2 | Supabase Postgres (projekt `fqhvxhnbeyvwubpnuzxe`, ok. 60 tabel + funkcje SQL) | dostęp tylko z funkcji serwera |
| Logowanie | Base44 Auth (e-mail + hasło z kodem OTP, Google) | SDK `@base44/sdk` |
| Pliki | Base44 storage (publiczne i prywatne + podpisane linki); filmy kursów i nagrania — własny serwer Dawida (`/v/…`, podpis HMAC, `stream.php`) | `integrations.Core.Upload*`, `base44/shared/videoSign.ts` |
| E-mail | SMTP (konfiguracja w Supabase `app_settings.smtp`, docelowo Brevo), kolejka `MailQueue` | `base44/shared/smtp.ts` |
| Płatności | PayU (REST + webhook `payuNotification`) | `base44/functions/payu*` |
| Zadania cykliczne | Base44 workflows (cron co 5/15 min, raz dziennie) | `base44/workflows/*.jsonc` |
| Integracje (OAuth przez Base44) | Supabase (Management API), Google Calendar (rezerwacje 1:1), Instagram (feed) | `base44/connectors/*.jsonc` |

DNS i poczta: Simply.com (MX, SPF `-all`, DMARC `p=reject`). A `@` → 216.24.57.1, `www` → CNAME base44.onrender.com. Funkcje są dostępne także pod `https://exmortis.pl/functions/<nazwa>`.

## 2. Moduły (co robi strona)

| Moduł | Front (src/) | Serwer | Dane |
|---|---|---|---|
| Strony i treści (edytor CMS, menu, przekierowania, publikacja z terminem) | `pages/CmsPage.jsx`, `components/cms`, `components/admin/cms` | `siteContent`, `adminContent`, `cmsScheduled`, `bootstrap` | SitePage, PublishedPage, PageVersion, CmsSection, SiteNav, PageRedirect, PublicSnapshot; Supabase `page_content` |
| Tryb przedpremierowy (do 1.11, 21:30) | `components/prelaunch`, `lib/usePrelaunch.js` | `siteSettings`, `bootstrap` | `app_settings.premiera` |
| Skarbiec (sklep), kasa, PayU, faktury, kody rabatowe, lista oczekujących | `pages/Shop*`, `ProductDetail.jsx`, `Checkout.jsx`, `components/admin/Product*`, `orders` | `shopProducts`, `checkDiscount`, `payuCreateOrder`, `payuNotification`, `orderFree`, `shopWaitlist`, `adminProducts`, `adminOrders` | Supabase `products`, `orders`, `waitlist`; Access, License, DiscountCode |
| Kursy wideo (lekcje, postęp, podpisane linki) | `pages/CoursePlayer.jsx`, `components/admin/course` | `course` | CourseLesson, LessonProgress, Access; filmy na serwerze Dawida |
| Moje konto (produkty, zakupy, ustawienia, RODO) | `pages/Account.jsx`, `components/account` | `myAccount`, `mySettings`, `gdprPerson` | Access, License, orders |
| Spotkania i webinary (zapisy, przypomnienia, /dolacz, nagrania) | `pages/Events.jsx`, `EventDetail.jsx`, `JoinMeeting.jsx`, `components/admin/events` | `eventsPublic`, `eventsAdmin`, `eventsCancel`, `eventShare`, `webinarSignup`, `myEvents` | Supabase `events`, `registrations` |
| Rezerwacje 1:1 (przełącznik wyłączony) | `pages/Rezerwacja*`, `components/booking`, `admin/booking` | `bookingPublic`, `bookingAdmin` | Supabase `bk_*`; sekrety BOOKING_HMAC_KEY, BOOKING_ENC_KEY; Google Calendar |
| Biblioteka i wiadomości (materiały dla klientów, grupy) | `components/account/library`, `admin/library` | `library`, `libraryAdmin`, `libraryTick` | Supabase `mb_*` |
| Newsletter „Listy powrotu” (double opt-in, kampanie) | `pages/ListyPotwierdz.jsx`, `admin/newsletter` | `subscribeNewsletter`, `adminNewsletter`, `adminSubscribers` | Supabase `subscribers`, `campaigns`, `newsletter_groups` |
| Cisza (minutnik), Głos (muzyka), Podcast, Obok (nagrania) | `pages/Cisza.jsx`, `Glos.jsx`, `Obok*.jsx`, `PodcastEpisode.jsx` | `silenceSession`, `silenceAdmin`, `obok` | Silence*, Utwor, Podcast*, Obok* |
| ROZDROŻA (interaktywne historie) | `pages/Rozdroza.jsx`, `components/rozdroza`, `admin/rozdroza` | `rozdroza`, `rozdrozaAdmin` | RozdrozaStory/Scene/Choice |
| Test „Która śmierć jest Twoja?” | `pages/Test*.jsx` | `shopQuizSubmit`, `adminQuiz` | Supabase `quiz_result` |
| Ogłoszenia na koncie | `components/account/AccountAnnouncements` | `announcements` | Announcement* |
| Bezpieczeństwo, dzienniki, RODO, zgody, odstąpienie | `admin/security`, `admin/gdpr`, `pages/Odstapienie.jsx` | `gdprPerson`, `withdrawal` | SecurityLog, ClientError, DataAccessLog, Consent, ConsentNote, Withdrawal, LegalDocVersion |
| Poczta (SMTP, kolejka, dziennik, DNS) | `admin/mail` | `mailAdmin` | MailQueue, `app_settings.smtp` |
| Zmiana adresu e-mail konta | `pages/ZmianaAdresu.jsx` | `emailChange` | EmailChange |

## 3. Role użytkowników

- `admin` — pełny panel `/admin`.
- `techniczna` — panel bez danych osobowych (treści, menu, ustawienia, integracje, Cisza).
- `user` — klient (Moje konto).
- `zablokowane` — konto nieaktywne.

Rola jest polem encji `User` (Base44). Sprawdzenia ról są zawsze po stronie serwera (`requireAdmin` w `base44/shared/supabase.ts` i `auth.me()` w funkcjach); front tylko ukrywa elementy.

## 4. Ustawienia i sekrety

- Ustawienia aplikacji: Supabase `app_settings` (klucze m.in. `app`, `firma`, `premiera`, `payu`, `smtp`, `dokumenty`, `zoom_staly`, `obrazy_ai`, `email_change_tick`) — odczyt/zapis przez `getSetting`/`saveSetting` (`base44/shared/settings.ts`). Hasła/klucze (PayU, SMTP, klucz OpenAI) są tam przechowywane i nigdy nie wracają do przeglądarki.
- Sekrety Base44 (`secrets.get`): `BOOKING_HMAC_KEY`, `BOOKING_ENC_KEY`.
- Supabase: brak klucza w kodzie — token pobierany przez łącznik OAuth Base44 (`connectors.getConnection("supabase")`), klucz `service_role` pobierany w locie i trzymany tylko w pamięci instancji.
- Tokeny zadań cyklicznych (`tick_token`) są jawnie w plikach workflow (workflow Base44 nie czyta sekretów). Obrót: akcja `tick_token` z `rotate` w danej funkcji + podmiana w pliku.

## 5. Bezpieczeństwo (zasady, które warto zachować)

- Ceny, rabaty i dostęp liczone wyłącznie na serwerze; PayU — weryfikacja podpisu, jednokrotne przejęcie COMPLETED.
- Limity nadużyć z IP (SecurityLog, `base44/shared/rateLimit.ts`, fail-open) na formularzach publicznych.
- SQL: wartości przez `escStr` (dollar-quoting z unikalnym znacznikiem) — nie składać zapytań z surowych danych.
- HTML w e-mailach: `escHtml` na danych od użytkownika.
- Pliki płatne: PDF ze znakiem wodnym kupującego; wideo przez podpisane, krótkotrwałe linki.
- Encje z danymi osobowymi mają RLS „tylko admin”; czytelnik ROZDROŻY dostaje tylko opublikowane kopie.
- Czyszczenie danych: zapisy na spotkania 90 dni po wydarzeniu, odpowiedzi z formularza rezerwacji 60 dni po rozmowie, dzienniki 12 miesięcy.

## 6. Wydajność

- Strony ładowane na żądanie (`lib/lazyPage.js`), obrazy w wariantach 480–2000 px przez `/functions/media` (WebP, cache).
- Rozgrzewanie funkcji co 5 min (workflow „Rozgrzewanie”), w dniu webinaru co minutę.
- Pomiary 12.10 na żywo: LCP 0,65–1,33 s, CLS ≤ 0,02.

## 7. Raporty i testy

- Raporty prac i audytów: `docs/raport_*.md`.
- Testy: skrypty Deno/Playwright uruchamiane podczas prac (wyniki w raportach); stałego CI brak — patrz MIGRACJA.md, krok „repozytorium i CI”.
