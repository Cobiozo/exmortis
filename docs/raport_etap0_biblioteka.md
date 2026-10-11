# RAPORT — ETAP 0 (inwentaryzacja i plan)

Moduły „Moja biblioteka” i „Wiadomości” + klienci i grupy w panelu · exmortis.pl · 11.10.2026

Nie zmieniono niczego: zero edycji plików, zero migracji, zero publikacji, `base44/mcp/config.json` nietknięty. Poniżej wyłącznie odczyt kodu, bazy i dokumentacji.

## a–f: ustalenia z dowodami

| # | Pytanie | Ustalenie | Dowód |
|---|---|---|---|
| **a** | Jak dziś trzymasz pliki | **Dwie ścieżki, obie już używane.** Prywatne (`UploadPrivateFile` → `file_uri`, bez publicznego adresu): PDF-y produktów, wideo lekcji kursu, nagrania Obok, oryginały biblioteki mediów, zgody podcastu. Publiczne (`UploadPublicFile` → `file_url`): zdjęcia produktów, okładki spotkań, tła i utwory Ciszy. | `adminProducts`, `course/entry.ts:55`, `admin/obok/RecordingUpload.jsx:22`, `admin/cms/media/uploadMedia.js:7`, `ProductEditor.jsx:93` |
| | Limity rozmiaru | Zależą od rozszerzenia: **JPEG/PNG/GIF/WebP 40 MB · SVG 5 MB · wideo i MP3/WAV 100 MB · PDF i rozszerzenia bez własnego limitu 10 MB.** | dokumentacja „Upload app file” |
| | Limit przestrzeni i transferu | **Brak twardego limitu przestrzeni** („możesz przechowywać tyle plików, ile potrzebuje aplikacja”). **Limitu transferu dokumentacja nie podaje** — nie potwierdzam, że istnieje. | dokumentacja „Uploading and managing media” |
| | ⚠️ Kolizja z Twoimi założeniami | PDF 50 MB i audio 150 MB **przekraczają** udokumentowane limity (10 MB / 100 MB). Do decyzji — patrz pytania. | jak wyżej |
| **b** | Wgranie prywatne + podpisany link | Wgranie: `UploadPrivateFile({file})` → `file_uri` (z przeglądarki). Link: `CreateFileSignedUrl({file_uri, expires_in})`, **60 s – 3600 s (max 1 godzina)**. Dziś używane: 3600 s (wideo kursu), 120 s (PDF/licencja), 60 s (przeróbka obrazu). `file_uri` nigdy nie trafia do klienta — link wydaje funkcja serwera po sprawdzeniu uprawnień. | `course/entry.ts:55`, `media/entry.ts:57`, `myAccount/entry.ts:73`, dokumentacja SDK |
| | Wniosek dla planu | PDF 10 min = OK. **Audio 60 min = dokładnie sufit** — dla nagrań dłuższych niż godzina odtwarzacz musi odnowić link w trakcie (nowe wywołanie, ten sam materiał). | — |
| **c** | Wideo YouTube / Vimeo / Bunny | **YouTube nocookie już działa** jako zaślepka: miniatura + przycisk, `iframe` ładuje się **dopiero po kliknięciu**, `youtube-nocookie.com/embed/{id}?autoplay=1`, `allowFullScreen`, pod spodem link do YouTube. **Vimeo i Bunny: nie ma ich nigdzie w aplikacji** — to nowa praca. | `exmortis/about/YouTubeEmbed.jsx` |
| | iPhone | Działa, ale trzeba dopisać `playsinline=1` (inaczej iOS wymusza pełny ekran) i zachować `allow="fullscreen; picture-in-picture"`. **Uwaga na `sandbox`:** YouTube i Vimeo wymagają `allow-scripts allow-same-origin` — zbyt ciasny sandbox **zabija odtwarzanie**. | — |
| | Cookies | Baner ma **2 kategorie** (analityczne, marketingowe) + niezbędne; brak kategorii „treści zewnętrzne”. Zaślepka „kliknij, aby odtworzyć” jest zgodna z banerem (klik = Twoja zgoda na ten jeden film), ale miniaturka z `i.ytimg.com` to zapytanie do YouTube **przed** kliknięciem. | `legal/cookieStore.js`, `CookieSettings.jsx` |
| **d** | Ogłoszenia i blok z porą dnia | Ogłoszenia: encje `Announcement` + `AnnouncementSeen` + `AnnouncementLog`; odbiorcy `wszyscy / produkt / obok / spotkanie`, statusy liczone (`Szkic / Zaplanowane / Aktywne / Zakończone`), znaczniki `seen/view/click/dismiss`, statystyki w panelu, **bez e-maili**. Blok z porą dnia: `DailyThought` + `content/thoughts.js` (`partOfDay`), podgląd pory `?godzina=2`. | `announcements/entry.ts`, `DailyThought.jsx` |
| | Kolejność na koncie | Dziś: **Ogłoszenia → Myśl na dziś**. Żądana: **najnowsza nieprzeczytana wiadomość → Ogłoszenia → Myśl**. | `Account.jsx:43-44` |
| **e** | Nagłówki odpowiedzi | Konfigurowalne **tylko**: polityka osadzania w iframe (Wszyscy / Tylko te strony / Nikt) i ograniczenia funkcji przeglądarki (Permissions-Policy). Ustawiasz to w **Ustawieniach aplikacji** w panelu. **CSP i HSTS nie są konfigurowalne dla aplikacji.** `X-Content-Type-Options` i `Content-Disposition` mogę ustawić **wyłącznie na odpowiedziach własnych funkcji** (endpointy plików/API), nie na stronach. | dokumentacja „security overview” + „running a security scan” |
| **f** | Model danych, funkcje, strony, ryzyka | poniżej | — |

## Proponowany model danych (Supabase, schemat `public`, prefiks `mb_`)

Wszystkie tabele: `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM PUBLIC, anon, authenticated` i **żadnych polityk** — z zewnątrz niewidoczne, dotyka ich wyłącznie `service_role` z funkcji. Identycznie jak `bk_*`. Zmiany wyłącznie dodające, z eksportem kopii dotykanych tabel przed migracją.

| Tabela | Pola | Ograniczenia / indeksy |
|---|---|---|
| `mb_settings` | `id=1`, `library_mode`, `messages_mode` (`off`/`admin`/`on`), `email_notify bool default false`, `whatsapp`, `space_limit_mb`, `updated_at` | `id` PK `CHECK(id=1)` — wzorzec z `bk_settings` |
| `mb_materials` | `id`, `title`, `description`, `kind`, `file_key`, `file_version`, `file_size`, `external_url`, `body_html`, `stage`, `tags text[]`, `duration_s`, `pages`, `allow_download`, `source`, `deleted_at`, `created_by`, `created_at`, `updated_at` | `CHECK kind IN (AUDIO,WIDEO,PDF,LINK,TEKST)`; `CHECK external_url IS NULL OR external_url ~ '^https://'`; `CHECK` spójności rodzaju (plik albo adres albo treść); `file_key` = losowy UUID, **bez nazw i e-maili**; indeksy: `(kind) WHERE deleted_at IS NULL`, `(created_at DESC)` |
| `mb_collections` | `id`, `title`, `description`, `sort`, `created_by`, `created_at` | — |
| `mb_collection_items` | `collection_id`, `material_id`, `position` | `UNIQUE(collection_id, material_id)`, indeks `(collection_id, position)` |
| `mb_groups` | `id`, `name`, `color`, `description`, `kind`, `rule jsonb`, `created_by`, `created_at`, `updated_at` | `CHECK kind IN (RECZNA,AUTOMATYCZNA)`; automatyczne: `{typ:'produkt', id}` albo `{typ:'aktywny_pakiet'}` |
| `mb_group_members` | `group_id`, `client_email`, `added_by`, `added_at` | PK `(group_id, client_email)`, indeks `(client_email)` |
| `mb_assignments` | `id`, `material_id`, `collection_id`, `target_kind`, `target_email`, `group_id`, `group_mode`, `snapshot_emails text[]`, `exceptions_add text[]`, `exceptions_drop text[]`, `note`, `visible_from`, `visible_to`, `created_by`, `created_at`, `revoked_at` | dokładnie jedno z `material_id`/`collection_id`; dokładnie jedno z `target_email`/`group_id`; `TYLKO_OBECNI` wymaga `snapshot_emails`; indeksy `(target_email)`, `(group_id)`, `(material_id)`, `(collection_id)` |
| `mb_material_state` | `client_email`, `material_id`, `opened_at`, `completed_at` | PK `(client_email, material_id)`, indeks `(material_id)` |
| `mb_messages` | `id`, `title`, `body_html`, `status`, `send_at`, `email_mode`, `attached_material_id`, `attached_collection_id`, `idem_key`, `created_by`, `created_at`, `sent_at`, `withdrawn_at` | `CHECK status IN (SZKIC,ZAPLANOWANA,WYSLANA,WYCOFANA)`; `CHECK email_mode IN (BRAK,POWIADOMIENIE,PELNA)`; **`idem_key UNIQUE`** (idempotencja S8); indeks `(status, send_at) WHERE status='ZAPLANOWANA'` |
| `mb_message_recipients` | `message_id`, `client_email`, `delivered_at`, `read_at`, `hidden_at` | PK `(message_id, client_email)`, indeks `(client_email)`, `(message_id, read_at)` |
| `mb_templates` | `id`, `name`, `title`, `body_html`, `created_by`, `created_at` | — |
| `mb_log` | `id`, `at`, `actor`, `action`, `object_type`, `object_id`, `summary ≤500`, `anonymized` | tylko dopisywanie (trigger jak `bk_log_guard`), indeks `(at)`, retencja 12 mies. |

**Kluczowa decyzja:** widoczność materiału **liczona na serwerze przy każdym otwarciu** (przydział wprost LUB przez grupę wg trybu, minus wyjątki, plus dodani, w oknie dat, przy włączonym module) — **bez** kopiowania wierszy na osoby. Dzięki temu „materiał z dwóch źródeł widoczny raz” i „usunięty z grupy traci grupowe, zachowuje indywidualne” wychodzą same z zapytania.

## Funkcje i strony

| Warstwa | Element | Rola |
|---|---|---|
| Funkcja | `library` (nowa) | Klient: `my_library`, `my_messages`, `open_material` (sprawdzenie uprawnień → podpisany link), `mark_completed`, `read_message`, `hide_message`. Tożsamość **wyłącznie z sesji**. |
| Funkcja | `libraryAdmin` (nowa) | Panel: materiały (dodanie, nowa wersja, usunięcie), kolekcje + kolejność, grupy + członkostwo, przydziały, wiadomości (szkic/plan/wyślij/wycofaj/powiadomienie), lista klientów z filtrami, karta klienta i grupy, pulpit, podgląd oczami klienta, historia zmian, licznik przestrzeni |
| Funkcja | `libraryTick` (nowa) + workflow | Wysyłka zaplanowanych wiadomości (idempotentnie), powiadomienia e-mail, czyszczenie `mb_log` po 12 mies. — osobny workflow, tick rezerwacji nietknięty |
| Funkcja | `gdprPerson` (rozszerzenie) | Eksport i usunięcie danych klienta objąć nowymi tabelami, wpis zanonimizowany w `mb_log` |
| Moduł | `base44/shared/libraryAccess.ts` (nowy) | Jedna reguła widoczności używana przez obie funkcje |
| Strony | `/konto` — nowa zakładka „Moja biblioteka” + sekcja „Wiadomości” + najnowsza nieprzeczytana w nagłówku (nad Ogłoszeniami) | Bez zmian w Skarbcu, zakupach, Obok, spotkaniach |
| Panel | nowe sekcje: **Biblioteka** (Materiały, Kolekcje), **Grupy**, **Wiadomości**; rozszerzona istniejąca sekcja **Klienci**; dwa przełączniki w **Ustawieniach** | Menu dopisane do istniejącego, brak drugiej listy klientów |
| Biblioteki zewnętrzne | **0 nowych** | Sanityzację piszę własną listą dozwolonych znaczników w `shared/` (serwer) + istniejący `src/lib/sanitizeHtml.js` (wyświetlanie). Odtwarzacz: natywne `<audio>`/`<video>` i `iframe` — bez zależności |

## Ryzyka

1. **Brak dowodu przez HTTP do publikacji** — nowe akcje funkcji są niedostępne publicznie przed publikacją; testy B/W/S wykonamy po niej (ten sam objaw co w krokach 1B–4).
2. **Limity plików** — PDF 50 MB i audio 150 MB przekraczają limity platformy (10 MB / 100 MB).
3. **Licznik przestrzeni nie ma mianownika** — platforma nie ma twardego limitu, więc „ostrzeżenie przy 80%” wymaga progu ustawionego przez nas.
4. **`sandbox` vs odtwarzanie** — YouTube/Vimeo potrzebują `allow-scripts allow-same-origin`; ciasny sandbox blokuje play.
5. **CSP i Referrer-Policy niedostępne dla aplikacji** — punkt 5.13 wykonalny tylko częściowo (polityka iframe + Permissions-Policy z panelu; nagłówki tylko na odpowiedziach naszych funkcji).
6. **Podpisany link max 1 h** — długie nagrania wymagają odnowienia w trakcie odtwarzania.
7. **Tożsamość klienta = e-mail** — a aplikacja ma moduł zmiany adresu (`emailChange`); zmiana adresu musi przenieść dane biblioteki.
8. **Automatyczne grupy** muszą czytać zakupy i pakiety **bez zmiany** ich logiki (tylko odczyt, z indeksami i limitem).
9. **Dwa mechanizmy na koncie** (Ogłoszenia i Wiadomości) — ustalona kolejność: wiadomość → ogłoszenie → myśl.

## Pytania do Ciebie (blokery i decyzje)

1. **Limity plików:** PDF do 10 MB i audio do 100 MB (limity platformy), czy większe pliki tylko jako LINK?
2. **Licznik przestrzeni:** jaki próg przyjąć za 100% (np. 5 GB), skoro platforma go nie narzuca?
3. **Tożsamość klienta:** zostajemy przy e-mailu (spójnie z resztą) — a przy zmianie adresu dane biblioteki mają się przenieść automatycznie?
4. **Wiadomości vs Ogłoszenia:** dwa osobne mechanizmy, dzielące tylko miejsce na koncie i słownik statusów, Ogłoszenia nietknięte — potwierdzasz?
5. **iframe:** dopuszczam `allow-scripts allow-same-origin` (inaczej nie odtworzy), czy rezygnujemy z `sandbox` na rzecz białej listy domen?
6. **Cookies:** dodać trzecią kategorię „Treści zewnętrzne (wideo)”, czy klik-zaślepka wystarcza (jak dziś)? Miniaturka z `i.ytimg.com` ładuje się przed kliknięciem — zostawić czy zastąpić własną grafiką?
7. **Bunny:** który produkt (Stream czy CDN/pull zone) i jaką domenę wpisać na białą listę?
8. **Stare wersje plików:** trzymać (zajęte miejsce rośnie), czy usuwać przy zamianie?
9. **Numer WhatsApp:** skąd ma pochodzić — z danych firmy (stopki maili), czy z nowego pola w ustawieniach biblioteki?

Czekam na **„OK, etap 1”**.