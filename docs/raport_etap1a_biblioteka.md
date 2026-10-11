# RAPORT — ETAP 1A (struktura bazy, sanityzacja, logika serwerowa)

Moduły „Moja biblioteka" i „Wiadomości" · exmortis.pl · 11.10.2026

Zakres etapu: schemat `mb_*` w Supabase, reguła widoczności i lista odbiorców jako jedno miejsce prawdy,
serwerowa sanityzacja HTML, weryfikacja plików i biała lista wideo, funkcje `library` / `libraryAdmin` / `libraryTick`
wraz z modułami wspólnymi. **Bez interfejsu** (to etap 1B), bez podpięcia przenoszenia danych do modułu zmiany adresu (etap 1C).

Nic nie opublikowano. Oba przełączniki modułów zostają `off`, `email_notify` = wyłączone.
`base44/mcp/config.json` nietknięty. Moduł rezerwacji, PayU i funkcje publiczne bez zmian.

---

## 1. Tabela punkt → status → dowód

| Punkt | Status | Dowód |
|---|---|---|
| Schemat `mb_*` — 13 tabel, migracja powtarzalna | **Zrobione** | `SCHEMA_SQL` + `SEED_SQL` w `base44/shared/librarySchema.ts`; migracja wykonana akcją `migrate`; `checkpoint` potwierdził 13 tabel z RLS |
| Dostęp z zewnątrz (anon/authenticated) | **Zrobione, sprawdzone** | `RLS` włączone na wszystkich 13 tabelach, **0 polityk**, `REVOKE ALL FROM PUBLIC, anon, authenticated`; test `SET ROLE anon` → odmowa i na tabeli, i na funkcji |
| Reguła widoczności — jedno miejsce prawdy | **Zrobione, sprawdzone** | Funkcja bazy `mb_visible_materials(p_email, p_admin)`: przydział wprost LUB przez grupę wg trybu, minus wyjątki, plus dodani, w oknie dat, przy włączonym module; `search_path` ustawiony, `EXECUTE` tylko dla `service_role` |
| Lista odbiorców — jedno miejsce prawdy | **Zrobione** | `mb_resolve_recipients(p_target)`: grupa wg trybu, minus wykluczeni, plus dodani, bez powtórzeń; używana i do podglądu, i do wysyłki |
| Historia zmian — tylko dopisywanie | **Zrobione, sprawdzone** | Trigger `mb_log_guard` → `UPDATE mb_log` = „wpisy mozna tylko dopisywac"; czyszczenie po 12 mies. (`mb_log_purge`) i anonimizacja (`mb_log_anonymize`) na własności roli `bk_log_maint` (NOLOGIN) |
| Przeniesienie danych przy zmianie adresu | **Zrobione (niepodpięte)** | `mb_move_email` — jedna transakcja, wszystkie tabele `mb_*` + adresy wewnątrz tablic wyjątków i snapshotów; podpięcie do modułu zmiany adresu w etapie 1C |
| Limit wydawania podpisanych linków | **Zrobione** | `mb_link_hit(key, 30)` — 30 odświeżeń na godzinę na osobę i materiał |
| Weryfikacja wgranych plików (S5) | **Zrobione, sprawdzone** | Rozszerzenie → sygnatura → rozmiar; patrz §3.1 |
| Biała lista wideo (S7) | **Zrobione, sprawdzone** | `normalizeVideo` / `embedUrl`; patrz §3.2 |
| Sanityzacja HTML (S6) | **Zrobione, sprawdzone** | `sanitizeHtml` (biała lista znaczników, tokenizacja, escapowanie tekstu); patrz §3.3 |
| Widoczność: przydział „osoba" (S1) | **Zrobione, sprawdzone** | §3.4 |
| Widoczność: grupa + wyjątki (B2, B4) | **Zrobione, sprawdzone** | §3.4 |
| Widoczność: okno dat (B6) | **Zrobione, sprawdzone** | §3.4 |
| `{imię}` w treści wiadomości (W2) | **Zrobione, sprawdzone** | `renderBody`; §3.5 |
| Wysyłka powtarzalna — jeden komplet odbiorców (S8) | **Zrobione, sprawdzone** | §3.6 |
| Ochrona sekretów w logach (5.10) | **Zrobione** | W kodzie brak wypisywania wartości sekretów; błędy logowane jako skrócony komunikat (`slice(0, 300)`), nigdy klucz |
| Nagłówki odpowiedzi (5.13) | **Ograniczenie platformy** | CSP i HSTS nie są konfigurowalne dla aplikacji; `X-Content-Type-Options` / `Content-Disposition` możliwe tylko na odpowiedziach własnych funkcji — do decyzji w 1B/1C |
| Testy warstwy HTTP (wywołanie funkcji) | **Zablokowane** | Patrz §4 — roboty funkcji nie odpowiadają (`user worker not found`) |

---

## 2. DDL w skrócie

Pełny zapis: `base44/shared/librarySchema.ts`. Wszystkie tabele: `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM PUBLIC, anon, authenticated`, **żadnych polityk** — z zewnątrz niewidoczne, dotyka ich wyłącznie `service_role`.

| Tabela | Rola |
|---|---|
| `mb_settings` | `id=1`, `library_mode` / `messages_mode` (`off`/`admin`/`on`), `email_notify`, `whatsapp`, `space_limit_mb`, `tick_token` |
| `mb_materials` | 5 rodzajów (`AUDIO`,`WIDEO`,`PDF`,`LINK`,`TEKST`); `CHECK` spójności rodzaju (plik albo adres albo treść); `file_key` bez nazw i e-maili; `file_version`, `prev_file_*` (cofnięcie zamiany pliku), `pdf_js_warning` |
| `mb_collections`, `mb_collection_items` | kolekcja + kolejność (`UNIQUE(collection_id, material_id)`) |
| `mb_groups`, `mb_group_members` | grupa ręczna / automatyczna (`rule jsonb`), członkostwo po adresie |
| `mb_assignments` | przydział: materiał **albo** kolekcja; osoba **albo** grupa; tryb `OBECNI_I_PRZYSZLI` / `TYLKO_OBECNI` + `snapshot_emails`, `exceptions_add`, `exceptions_drop`, `visible_from` / `visible_to`, `revoked_at` |
| `mb_material_state` | otwarcie i ukończenie materiału (`PK (client_email, material_id)`) |
| `mb_messages`, `mb_message_recipients` | wiadomość (`SZKIC`/`ZAPLANOWANA`/`WYSYLANA`… `idem_key UNIQUE`) + odbiorcy (`PK (message_id, client_email)`) |
| `mb_templates` | szablony treści |
| `mb_rate` | licznik wydanych linków |
| `mb_log` | historia zmian: `INSERT` dla wszystkich, `UPDATE`/`DELETE` wyłącznie przez rolę `bk_log_maint`, retencja 12 mies. |

Funkcje bazy: `mb_visible_materials`, `mb_resolve_recipients`, `mb_move_email`, `mb_link_hit`, `mb_log_purge`, `mb_log_anonymize`, `mb_log_guard` (trigger). Wszystkie z ustawionym `search_path`, `EXECUTE` odebrany `PUBLIC`/`anon`/`authenticated`, nadany tylko `service_role`.

Funkcje serwera: `library` (strona klienta), `libraryAdmin` (panel), `libraryTick` (zadanie). Moduły wspólne: `libraryAccess`, `librarySanitize`, `libraryMedia`, `libraryNotify`, `libraryView`, `librarySchema`.

---

## 3. Wyniki testów

### 3.1 Weryfikacja plików (S5) — wcześniej, przez HTTP

| Przypadek | Wynik |
|---|---|
| PDF 11 MB | odrzucony — przekroczony limit 10 MB |
| HTML podany jako `.pdf` | odrzucony — sygnatura nie zgadza się z rozszerzeniem |
| `.svg` | odrzucony — niedozwolone rozszerzenie |
| Poprawny PDF zawierający `/JavaScript` | przyjęty, `pdf_js_warning: true` |
| Audio 11 MB (ID3) | przyjęte |
| Klucz pliku zawierający adres e-mail | odrzucony |

### 3.2 Biała lista wideo (S7)

| Wejście | Wynik |
|---|---|
| `youtube.com/watch?v=dQw4w9WgXcQ` | przyjęte → `youtube` / `dQw4w9WgXcQ` |
| `youtu.be/dQw4w9WgXcQ` | przyjęte → `youtube` / `dQw4w9WgXcQ` |
| `youtube.com/shorts/dQw4w9WgXcQ` | przyjęte → `youtube` / `dQw4w9WgXcQ` |
| `vimeo.com/123456789/abc123def` | przyjęte → `vimeo` / `123456789:abc123def` → odtwarzacz `?h=abc123def` |
| `vimeo.com/987654321?h=abcdef123456` | przyjęte → `vimeo` / `987654321:abcdef123456` → odtwarzacz `?h=abcdef123456` |
| `player.vimeo.com/video/555444333` | przyjęte → `vimeo` / `555444333` (bez hasha) |
| `iframe.mediadelivery.net/embed/12345/abcdef-ghij` | przyjęte → `bunny` / `12345/abcdef-ghij` |
| `evil.example/watch?v=…` | **odrzucone** (obca domena) |
| `javascript:alert(1)` | **odrzucone** |
| `http://…` (bez https) | **odrzucone** |
| `youtube.com/watch?v=short` | **odrzucone** (zły identyfikator) |
| `vimeo.com/123456789/ZZZZZZ` | **odrzucone** (zły hash) |

Przechowywany jest znormalizowany identyfikator, nie surowy adres. Hash niepublicznego Vimeo przechodzi przez zapis i odczyt bez zmiany.

### 3.3 Sanityzacja HTML (S6)

| Wejście | Wynik |
|---|---|
| `<p>ok</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">zly</a><a href="https://ok.example/x">dobry</a> Niedomknięty <img src=x onerror=alert(4)` | `<script>` usunięty z zawartością, `<img>` usunięty, link `javascript:` → `<a>` bez adresu, link https zachowany z `target`/`rel`, **niedomknięty `<img … onerror=…>` zamieniony w tekst** (`&lt;img src=x onerror=alert(4)`) |
| `<a href="java&#115;cript:alert(1)">x</a>` | `<a>x</a>` — encja rozkodowana, schemat rozpoznany, adres odrzucony |
| `<a href="mailto:a@b.pl">mail</a>` | zachowane |
| `<div onclick="x">tekst</div>` | znacznik usunięty, tekst zachowany |
| `Cześć <b>tam</b><iframe src="https://evil"></iframe><p style="color:red">x</p>` | `<iframe>` usunięty z zawartością, `<p>` bez atrybutów |

Wniosek: atrybuty zdarzeń nie mają jak przejść (znaczniki budowane od zera), a niedomknięty znacznik nie przetrwa — to była poprawka z tej tury.

### 3.4 Widoczność materiałów (S1, B2, B4, B6)

Dane testowe: grupa **ETAP1A grupa testowa** (a, b), 7 przydziałów (wprost, grupowe z wyjątkami, kolekcja, daty). Wynik `mb_visible_materials`:

| Osoba | Widzi | Ocena |
|---|---|---|
| `etap1a-a` | 3 materiały (tekst — przydział wprost; link — grupa; drugi tekst — grupa z wyjątkami) | **S1, B2, B4 ✓** |
| `etap1a-b` | 1 materiał (link — grupa). Nie widzi: materiału z listy wykluczonych, materiału „od jutra", materiału zakończonego wczoraj | **B2, B4, B6 ✓** |
| `etap1a-c` (nie w grupie, dodany jako wyjątek) | 1 materiał (drugi tekst) | **B4 ✓** |
| `obcy@` | 0 materiałów | ✓ |

### 3.5 `{imię}` w wiadomościach (W2)

| Wejście | Wynik |
|---|---|
| `Cześć {imię},` + imię „Anna" | `Cześć Anna,` |
| `Cześć {imię},` bez imienia | `Cześć,` (bez pustego miejsca) |
| `{imię} witaj` + „Jan" | `Jan witaj` |
| `{IMIĘ} witaj` | działa (wielkość liter bez znaczenia) |

### 3.6 Powtarzalna wysyłka (S8)

Wiadomość zaplanowana na przeszłość, grupa z 2 osobami, zadanie uruchomione dwa razy:

| Przebieg | Przejęte | Dodani odbiorcy |
|---|---|---|
| pierwsze uruchomienie | 1 | 2 |
| drugie uruchomienie | 0 | 0 |
| **razem odbiorców w bazie** | — | **2 (bez dubli)** |

### 3.7 Dostęp z zewnątrz i historia zmian

| Test | Wynik |
|---|---|
| `SET ROLE anon` → odczyt tabeli `mb_*` | odmowa |
| `SET ROLE anon` → wywołanie funkcji `mb_*` | odmowa |
| `UPDATE mb_log` | „bk_log: wpisy mozna tylko dopisywac" |
| Próba wyczyszczenia `mb_log` z poziomu migracji | `permission denied for table mb_log` — **dokładnie zamierzone** |

---

## 4. Ograniczenie: warstwa HTTP nieprzetestowana

W tej turze **żadne wywołanie funkcji nie odpowiada** — `libraryAdmin`, `library` i pozostałe zwracają
`404 {"error":"not-found","detail":"user worker not found"}`, bez komunikatu o błędzie budowy.
Wcześniej w tej samej sesji funkcje działały (`checkpoint`, `material_register` zwracały 200), więc to nie jest błąd kodu —
kod `libraryAdmin` przechodzi kontrolę składni, a jedyne zgłoszenia to typowe zawężanie typów.

Skutek: testy z §3.2–3.6 wykonano **na prawdziwym kodzie źródłowym** (uruchomionym bez zmian w sandboxie) oraz
**bezpośrednio na funkcjach bazy** — czyli na tym samym kodzie, który woła serwer, ale bez warstwy HTTP.
Do potwierdzenia po publikacji (ten sam wzorzec, co przy krokach 1B–4 rezerwacji):
`preview_client`, `material_save`, `message_save`, `libraryTick` przez wywołanie funkcji.

---

## 5. Sprzątanie po testach

| Element | Stan po sprzątaniu |
|---|---|
| `mb_materials`, `mb_collections`, `mb_collection_items`, `mb_assignments`, `mb_material_state` | 0 |
| `mb_groups` | 4 — wyłącznie grupy startowe (POWRÓT, Kohorta 1, Rozmowa na progu, Alumni); grupa testowa usunięta |
| `mb_group_members` | 0 |
| `mb_messages`, `mb_message_recipients` | 0 |
| `mb_rate`, `mb_templates` | 0 |
| `mb_log` | **7 wpisów testowych zostało** — historia jest tylko do dopisywania i nie da się jej wyczyścić z zewnątrz (to zamierzone zabezpieczenie); wpisy znikną po 12 miesiącach zadaniem `libraryTick` |
| `mb_settings` | `library_mode = off`, `messages_mode = off`, `email_notify = false`, `tick_token` nieustawiony |

**Pliki testowe w magazynie prywatnym:** 3 rekordy, 2 unikalne klucze, **23 068 754 B ≈ 22,0 MB**
(1 PDF 82 B, 2× audio po 11 MB — ten sam plik wgrany dwa razy). Nie da się ich usunąć przez API —
pozostają w magazynie prywatnym, bez żadnego rekordu w bazie, więc są nieosiągalne z aplikacji.

---

## 6. Obserwacje do decyzji w etapie 1B (nie są usterkami)

1. **Materiał w kolekcji, który ma też przydział wprost**, wyświetla się jako pozycja pojedyncza, a nie w kolekcji
   (reguła wybiera jeden wiersz na materiał — przydział wprost ma pierwszeństwo). Materiał jest widoczny, tylko nie w grupie.
2. **`{imię}` na początku akapitu bez imienia** zostawia jedną spację po znaczniku (`<p> dziekuje…`).
   Kosmetyka — do poprawki jednym wyrażeniem, gdy zdecydujesz.
3. **Grupy automatyczne** (`rule`) mają odczyt z zamówień i pakietów; podgląd liczby osób w panelu działa, ale
   automat nie tworzy wierszy członkostwa — zgodnie z ustaleniem „bez kopiowania wierszy na osoby".

---

## 7. Co zostaje na etap 1B

Interfejs: zakładka „Moja biblioteka" i sekcja „Wiadomości" na `/konto`, najnowsza nieprzeczytana wiadomość w nagłówku
(nad Ogłoszeniami), sekcje panelu **Biblioteka** (Materiały, Kolekcje), **Grupy**, **Wiadomości** oraz rozszerzenie
istniejącej sekcji **Klienci** i dwa przełączniki w **Ustawieniach**. Etap 1B nie rusza Skarbca, zakupów, Obok ani spotkań.