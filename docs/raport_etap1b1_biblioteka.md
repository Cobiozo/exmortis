# RAPORT — ETAP 1B-1 (panel biblioteki: ustawienia, materiały, kolekcje, grupy, przydziały)

Moduły „Moja biblioteka" i „Wiadomości" · exmortis.pl · 11.10.2026

Zakres etapu: pierwsza tura interfejsu — dwa przełączniki trójstanowe w **Ustawieniach**, sekcje panelu
**Biblioteka** (Materiały, Kolekcje) i **Grupy**, rozszerzenie istniejącej sekcji **Klienci**
(kolumna grup, filtry, akcje zbiorcze, karta klienta z przydziałami) oraz jedno okno przydziału wołane
z czterech miejsc. Wiadomości (1B-2) i strona klienta (1B-3) — poza zakresem.

Nic nie opublikowano. Oba przełączniki modułów zostają `off`, `email_notify` = wyłączone.
`base44/mcp/config.json` nietknięty. Skarbiec, zakupy, Obok, spotkania i moduł rezerwacji bez zmian.

---

## 1. Tabela punkt → status → dowód

| Punkt | Status | Dowód |
|---|---|---|
| Ustawienia: dwa przełączniki trójstanowe + potwierdzenie „Włączone" | **Zrobione** | `LibrarySettingsPanel` + `TriSwitch`; zapis akcją `save_settings` (§4.7) |
| Ustawienia: e-mail o nowych materiałach, WhatsApp, próg przestrzeni | **Zrobione** | `save_settings` z walidacją `^https://wa\.me/[0-9]{6,20}$` i progiem 64–1048576 MB |
| Sekcje panelu zależne od przełączników + ekran „Moduł wyłączony" | **Zrobione** | `LibraryPanel` → `LibraryDisabled`; pozycje `biblioteka`/`grupy` w `Admin.jsx` tylko dla roli `admin` (rola `techniczna` ich nie widzi) |
| Materiały: 5 rodzajów, filtry i wyszukiwarka liczone na serwerze | **Zrobione, sprawdzone** | `materials_list` (§4.1) |
| Materiały: wgrywanie z limitami widocznymi przed wyborem | **Zrobione, sprawdzone** | PDF 59 B, PDF z aktywną treścią 86 B, MP3 300 B — przyjęte; `.svg` odrzucone (§4.2) |
| Materiały: zamiana pliku i przywrócenie poprzedniej wersji | **Zrobione** | `material_replace` / `material_restore_prev` (jedna wersja wstecz), przydziały bez zmian |
| Materiały: usuwanie z liczbą osób tracących dostęp | **Zrobione, sprawdzone** | `material_impact` → `{osoby: 1, przydziały: 1}` (§4.5) |
| Edytor tekstu odziera wklejanie ze stylów | **Zrobione** | `RichLite` — matcher clipboardu zostawia tylko `bold`, `italic`, `list`, `header`, `link` |
| **Listy punktowane zapisywane jako `<ul>`** | **Zrobione, sprawdzone** | Poprawka przed testami — §3; wynik w §4.3 |
| Kolekcje: tworzenie, opis, kolejność | **Zrobione, sprawdzone** | `collection_save` + `collections_list` (§4.4) |
| Grupy: ręczne (8 kolorów) i automatyczne (produkt / aktywny pakiet z typem) | **Zrobione, sprawdzone** | `group_save`, `rule_options`, `groups_list` (§4.6) |
| Grupy: 4 startowe „do akceptacji" + Zostaw | **Zrobione, sprawdzone** | `group_accept` (§4.6) |
| Grupy: usuwanie z pytaniem o materiały członków | **Zrobione** | `group_delete` z `materials: "odbierz"` / `"zostaw"` |
| Klienci: filtry, checkboxy, „Zaznacz wszystkie wyniki filtra", akcje zbiorcze | **Zrobione, sprawdzone** | `clients_list` (§4.7) |
| Klienci: przy obu „off" widok bez zmian | **Zrobione, sprawdzone** | `ClientsPanel` → `ClientsClassic`; porównanie w §4.8 |
| Okno przydziału z podsumowaniem „Przydzielasz N osobom" | **Zrobione, sprawdzone** | `assignment_preview` + `assignment_bulk` (§4.5) |
| Odebranie dostępu: pojedynczo i całej grupie | **Zrobione, sprawdzone** | `assignment_revoke` (§4.5) |
| Widok 375 px | **Niesprawdzone wizualnie** | Brak narzędzia zrzutu w tej sesji — sprawdzone tylko na poziomie kodu (§6.1) |
| Migracja i kontrola dostępu po zmianach | **Zrobione, sprawdzone** | `checkpoint` — §4.9 |
| Budowa aplikacji | **Zrobione** | `vite build` — kod wyjścia 0 |

---

## 2. Nowe pliki i zmiany

**Interfejs (nowe):** `src/components/admin/library/` — `libApi.js`, `LibModal.jsx`, `TriSwitch.jsx`,
`SpaceBar.jsx`, `LibraryDisabled.jsx`, `LibraryPanel.jsx`, `LibrarySettingsPanel.jsx`, `MaterialsTab.jsx`,
`MaterialForm.jsx`, `MaterialRow.jsx`, `MaterialUpload.jsx`, `RichLite.jsx`, `CollectionsTab.jsx`,
`CollectionForm.jsx`, `GroupsTab.jsx`, `GroupForm.jsx`, `AssignDialog.jsx`, `AssignList.jsx`,
`ClientPicker.jsx`; `src/components/admin/clients/` — `ClientsLibraryList.jsx`, `ClientLibraryBox.jsx`.

**Interfejs (zmienione):** `ClientsPanel.jsx` (wybór widoku), `ClientsClassic.jsx` (wydzielenie),
`AdminDashboard.jsx` (kafle), `Admin.jsx` (sekcje), `SiteSettingsPanel.jsx` (karta modułów).

**Serwer:** `libraryAdmin` — nowe akcje: `material_impact`, `material_restore_prev`, `rule_options`,
`group_accept`, `assignment_bulk`, `clients_list`, `client_detail`; `mb_groups.accepted_at`,
`mb_auto_group_emails` z opcjonalnym `type_id`, `mb_group_members_now`.

---

## 3. Poprawka przed testami — listy punktowane

`react-quill-new` (Quill 2) zapisuje listę punktowaną jako `<ol><li data-list="bullet">`.
Sanityzacja zdejmuje wszystkie atrybuty, więc lista punktowana wyszłaby jako **numerowana**.

Naprawione **po stronie serwera**, w `fixQuillLists()` w `base44/shared/librarySanitize.ts`, uruchamianej
na początku `sanitizeHtml()` — przed zdjęciem atrybutów. Pierwszy punkt w bloku rozstrzyga rodzaj listy:
`data-list="bullet"` → otaczający `<ol>` staje się `<ul>`; brak `data-list` → zwykły HTML, bez zmian.
Wybrano stronę serwera, a nie `getSemanticHTML()`, z trzech powodów: to jedno miejsce obejmuje również
treści wiadomości i wklejony HTML z zewnątrz, nie zmienia trybu kontrolowanego edytora (brak ryzyka
przeskoczenia kursora), a `sanitizeHtml` i tak działa przy zapisie **i** przy odczycie.

Pierwsza wersja poprawki podmieniała tylko znacznik zamykający (`<ol>…</ul>`) — wykryte w teście i naprawione
poprzez odłożenie podmiany otwierającego znacznika do momentu poznania rodzaju listy.

---

## 4. Wyniki testów

### 4.1 Materiały — zapis i odczyt

| Sprawdzenie | Wynik |
|---|---|
| `material_save` na wgrany PDF (tytuł, opis, etap, tagi, 12 stron, pobieranie) | `ok` |
| `material_save` na wgrany MP3 (czas 754 s) | `ok` |
| `materials_list` — liczba pozycji | 6 (3 wgrane + wideo + odnośnik + tekst) |
| PDF z aktywną treścią — flaga z wgrania | `pdf_js_warning: true` |
| PDF — rozmiar z serwera, wersja pliku | 59 B, `file_version: 1` |
| `material_impact` przed przydziałami | `{osoby: 0, przydziały: 0}` |

### 4.2 Weryfikacja wgranych plików

| Przypadek | Wynik |
|---|---|
| Poprawny PDF (59 B) | przyjęty, `file_size: 59` |
| PDF zawierający `/JavaScript` (86 B) | przyjęty, `pdf_js_warning: true` |
| MP3 z nagłówkiem `ID3` (300 B) | przyjęty, `file_size: 300` |
| `.svg` zgłoszony jako PDF | **odrzucony** (HTTP 400, niedozwolone rozszerzenie) |

Pliki wgrywane są **przez przeglądarkę** (`UploadPrivateFile` → *przechowywane prywatnie*),
a serwer rejestruje je dopiero po sprawdzeniu rozszerzenia, sygnatury i rozmiaru.

### 4.3 Lista punktowana — po poprawce

| Wejście (z edytora) | Wynik |
|---|---|
| `<ol><li data-list="bullet">Punkt A</li><li data-list="bullet">Punkt B</li></ol>` | **`<ul><li>Punkt A</li><li>Punkt B</li></ul>`** |
| `<ol><li data-list="ordered">Krok 1</li></ol>` | `<ol><li>Krok 1</li></ol>` (bez zmian) |
| `<ol><li data-list="bullet">Rodzic<ol><li data-list="ordered">Dziecko</li></ol></li></ol>` | `<ul><li>Rodzic<ol><li>Dziecko</li></ol></li></ul>` |
| `<ul><li>Zwykly HTML</li></ul>` | bez zmian |

### 4.4 Kolekcja — kolejność

Wejście: 3 materiały z pozycjami 1 / 2 / 3 podane **nie po kolei** (tekst=3, PDF=1, audio=2).
Odczyt `collections_list`: `1:PDF, 2:AUDIO, 3:TEKST` — **kolejność zachowana**.

### 4.5 Przydziały i odebranie dostępu

| Sprawdzenie | Wynik |
|---|---|
| `assignment_preview` (osoby) | `count: 1`, imię rozwiązane (`Dawid Kowalczyk`) |
| `assignment_bulk` na materiał | `{ok: true, count: 1}` |
| `assignments_of_material` po przydziale | `odbiorcy: 1`, 1 pozycja, `otwarte: 0` |
| `material_impact` po przydziale | `{osoby: 1, przydziały: 1}` |
| `assignment_revoke` (pojedynczo) | `{ok: true, count: 1}` → `odbiorcy: 0`, pozycja z `revoked_at` |
| `group_members_add` do grupy ręcznej | `{ok: true, count: 1}` |
| `assignment_save` kolekcji na **grupę** | `{ok: true, count: 1}` → `odbiorcy: 1`, nazwa grupy w pozycji |
| `assignment_revoke` (cała grupa) | `{ok: true, count: 1}` → `odbiorcy: 0`, pozycja odebrana |

### 4.6 Grupy

| Sprawdzenie | Wynik |
|---|---|
| `rule_options` | 29 produktów, 4 typy spotkań |
| Grupa ręczna | utworzona, kolor `#C9A24A`, `accepted_at` ustawione |
| Grupa automatyczna „aktywny pakiet" **z typem** | `rule: {typ: aktywny_pakiet, type_id: a0fc5dc2…}` |
| Grupa automatyczna „aktywny pakiet" **bez typu** | utworzona (obejmuje każdy aktywny pakiet) |
| Grupa automatyczna „kupił produkt" | utworzona, `rule: {typ: produkt, id: 482b5c9c…}` |
| Grupa automatyczna „produkt" bez wskazania produktu | **odrzucona** — „Wybierz produkt." |
| `group_accept` na grupie startowej | `{ok: true}` → grupa bez dopisku „do akceptacji" |
| `groups_list` — członkostwo grupy ręcznej po dodaniu | `members: [dawidkowalczyk.king@gmail.com]`, `count: 1` |

### 4.7 Klienci — filtry

| Filtr | Wynik |
|---|---|
| bez filtra | 1 |
| wyszukiwanie po fragmencie adresu | 1 |
| grupa — tryb „wszystkie" | 0 |
| grupa — tryb „którakolwiek" | 0 |
| bez grupy | 1 |
| z aktywnym pakietem | 0 |

### 4.8 Oba przełączniki „off" — porównanie

| Sprawdzenie | Wynik |
|---|---|
| `save_settings` → `library_mode: off`, `messages_mode: off`, `email_notify: false` | `ok` |
| `settings` po zapisie | `{library_mode: "off", messages_mode: "off", email_notify: false, space_limit_mb: 5120}` |
| `clients_list` przy obu „off" | **1** — identycznie jak przed testami |
| Widok w panelu | `ClientsPanel` przy obu „off" renderuje `ClientsClassic` — dotychczasowa sekcja Klienci, bez zmian |

### 4.9 Migracja i kontrola dostępu (checkpoint)

| Sprawdzenie | Wynik |
|---|---|
| Tabele `mb_*` | **13**, wszystkie z RLS, **0 polityk**, `anon`/`authenticated` bez `SELECT` i `INSERT` — 0 naruszeń |
| Funkcje `mb_*` | **8**, `anon`/`authenticated` bez `EXECUTE`, `search_path` ustawiony — 0 naruszeń |
| `mb_log_guard` | `SECURITY INVOKER` — **zamierzone** (funkcja triggera; wyjątek robi `SECURITY DEFINER` `mb_log_purge`) |
| Przestrzeń | 0 B / 0 plików |

---

## 5. Sprzątanie po testach

| Element | Stan po sprzątaniu |
|---|---|
| `mb_materials` | **0** (usunięte 7: PDF, PDF+JS, audio, wideo, odnośnik, 2× tekst) |
| `mb_collections`, `mb_collection_items` | **0** |
| `mb_assignments` | 0 aktywnych (`odbiorcy: 0`); wiersze odebrane zostają jako ślad historii |
| `mb_groups` | **4 — wyłącznie grupy startowe**, wszystkie z powrotem „do akceptacji" |
| `mb_group_members` | 0 (kaskada przy usunięciu grup testowych) |
| `mb_settings` | `library_mode = off`, `messages_mode = off`, `email_notify = false`, `whatsapp` pusty, próg 5120 MB |
| Przestrzeń modułu | **0 B / 0 plików** |
| `mb_log` | wpisy testowe **zostają** — historia jest tylko do dopisywania; znikną po 12 mies. zadaniem `libraryTick` |

**Pliki testowe w magazynie prywatnym:** 3 klucze, **445 B** razem (59 B + 86 B + 300 B).
Nie da się ich usunąć przez API — zostają w magazynie, bez rekordu w bazie, więc nieosiągalne z aplikacji.

---

## 6. Ograniczenia i obserwacje

### 6.1 Widok 375 px — niesprawdzone wizualnie

W tej sesji nie było narzędzia zrzutu ekranu, więc szerokość 375 px **nie została potwierdzona wizualnie**.
Na poziomie kodu nowe ekrany używają: `flex-wrap` na paskach zakładek i akcji, `grid` z jedną kolumną
poniżej `sm`, `min-w-0` na komórkach z długim tekstem, `overflow-x-auto` na tabelach, `text-[10px]`/`text-[11px]`
w etykietach technicznych oraz istniejącego `container-exm` z paddingiem 16 px.
**Do potwierdzenia w podglądzie przed uznaniem punktu za zamknięty.**

### 6.2 Przydział do 3 osób — w bazie jest 1 konto

Polecenie mówiło o 3 osobach testowych, ale aplikacja ma **jedno** konto
(`dawidkowalczyk.king@gmail.com`) — pozostałe adresy nie istnieją, więc `mb_resolve_recipients`
zwróciłoby mniej odbiorców niż podanych. Cały mechanizm (podgląd → przydział zbiorczy → odczyt → odebranie)
przeszedł na 1 osobie i jest niezależny od liczby: `assignment_bulk` przyjmuje do 500 adresów w jednym
wywołaniu, a `assignment_preview` pokazuje `N` policzone przez bazę. Sprawdzenie na 3 kontach będzie
możliwe po ich dodaniu.

### 6.3 Edycja materiału wideo

Adres filmu jest przechowywany jako dostawca + znormalizowany identyfikator, nie jako surowy adres.
Przy edycji samego tytułu pole adresu jest puste — serwer zostawia wtedy dotychczasowego dostawcę
i identyfikator (poprawione w tej turze), a zmiana filmu wymaga wklejenia adresu ponownie.

### 6.4 Materiał w kolekcji z przydziałem wprost

Bez zmian względem 1A: taki materiał pokazuje się jako pozycja pojedyncza, nie w kolekcji
(reguła wybiera jeden wiersz na materiał, przydział wprost ma pierwszeństwo). Materiał jest widoczny.

---

## 7. Co zostaje na dalsze tury

- **1B-2** — sekcja **Wiadomości** (szkice, planowanie, wysyłka, szablony, statystyki, wycofanie, powiadomienie o nieprzeczytanych).
- **1B-3** — strona klienta „Moja biblioteka" i „Wiadomości" na `/konto` + najnowsza nieprzeczytana wiadomość w nagłówku.
- **Potwierdzenie widoku 375 px** w podglądzie (§6.1).

Nic nie opublikowano. `base44/mcp/config.json` bez zmian. Moduł rezerwacji, PayU i funkcje publiczne bez zmian.