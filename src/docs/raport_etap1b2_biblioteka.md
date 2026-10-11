# RAPORT — ETAP 1B-2 (sekcja wiadomości, karty klienta i grupy, historia zmian, zadanie co 5 minut)

Moduły „Moja biblioteka" i „Wiadomości" · exmortis.pl · 11.10.2026

Zakres etapu: sekcja panelu **Wiadomości**, karta klienta (wiadomości + szybkie akcje + podgląd oczami klienta),
karta grupy, kafelek pulpitu, **Historia zmian** i zadanie `libraryTick` jako workflow co 5 minut.

Nic nie opublikowano. Oba przełączniki modułów zostają `off`, `email_notify` = wyłączone.
`base44/mcp/config.json` nietknięty. Skarbiec, zakupy, Obok, spotkania, rezerwacje, Ogłoszenia
i strona klienta (`/konto`) bez zmian. Rola „techniczna" nie ma dostępu do nowych sekcji.

---

## 1. Tabela punkt → status → dowód

| Punkt | Status | Dowód |
|---|---|---|
| 1. Sekcja „Wiadomości" z zakładkami Wysłane · Zaplanowane · Szkice · Szablony | **Zrobione** | `MessagesPanel` + `TemplatesTab`; przy `messages_mode = off` sekcja pokazuje tylko informację |
| 2. Tworzenie wiadomości: odbiorcy tym samym oknem co przydział | **Zrobione** | `TargetPicker` — jedno źródło dla `AssignDialog` i `MessageForm`; podsumowanie i rozwijana lista (§4, W1/W3) |
| 2. Tytuł opcjonalny, treść w RichLite (getSemanticHTML), przycisk `{imię}` | **Zrobione** | `RichLite` w trybie znaczeniowym (niekontrolowany — brak przeskoku kursora) + przycisk z podpowiedzią (§4, W2) |
| 2. Podgląd „tak zobaczy to [osoba]" liczony na serwerze | **Zrobione** | `message_preview` → `sanitizeHtml(renderBody(...))`, ta sama ścieżka co u klienta; stała stopka (§4, W3) |
| 2. Dołączony materiał lub kolekcja = przydział tym samym odbiorcom | **Zrobione, sprawdzone** | §4 W5 — po naprawie błędu (patrz §3.1) |
| 2. Kopia e-mail: Brak / Powiadomienie / Pełna treść z ostrzeżeniem | **Zrobione, sprawdzone** | §4 W4 — „powiadomienie bez treści" w kolejce; ostrzeżenie przy „pełnej treści" |
| 2. Wyślij teraz / Zaplanuj (PL → UTC) / Zapisz szkic / Zapisz jako szablon | **Zrobione** | `plToUtc` / `utcToPlInput` (uwzględniają czas letni i zimowy); zapis jako szablon w formularzu |
| 2. Potwierdzenie powyżej 10 odbiorców | **Zrobione** | Osobne okno „Wysłać do ponad 10 osób?" przed wysłaniem |
| 2. Limit 20 wysłanych na godzinę z czytelnym komunikatem | **Zrobione, sprawdzone** | §4 — dwudziesta pierwsza wysyłka odmówiona |
| 3. „Przeczytane X / Y" i lista odbiorców (kto i kiedy) | **Zrobione, sprawdzone** | `MessageRow` + `message_stats`; §4 |
| 3. Powiadomienie e-mail do nieprzeczytanych, raz na 24 h | **Zrobione, sprawdzone** | §4 W7 — drugie wywołanie odmówione |
| 3. Poprawka literówki wysłanej (wpis w Historii, bez e-maila) | **Zrobione, sprawdzone** | §4 W8 |
| 3. „Wycofaj" z ostrzeżeniem o e-mailu | **Zrobione, sprawdzone** | §4 — komunikat „Wysłanego e-maila nie da się cofnąć." |
| 3. Zaplanowaną można edytować i anulować do przejęcia | **Zrobione, sprawdzone** | §4 — anulowanie ok, powtórka odmówiona |
| 4. Karta klienta: historia wiadomości i stan przeczytania | **Zrobione** | `ClientMessagesBox` — w miejscu dawnego „W przygotowaniu" |
| 4. Szybkie akcje: Napisz wiadomość, Przydziel materiał, Dodaj do grupy, Umów sesję | **Zrobione** | `ClientMessagesBox`; „Umów sesję" tylko gdy rezerwacje ≠ off (patrz §6.2) |
| 4. Akcja zbiorcza „Napisz wiadomość" na liście klientów | **Zrobione** | `ClientsLibraryList` — przycisk przy zaznaczonych, z presetem odbiorców |
| 5. Karta grupy: członkowie, materiały, wiadomości, dwie akcje | **Zrobione, sprawdzone** | `GroupPanel` + `group_detail`; §4 |
| 6. Kafelek pulpitu (gdy którykolwiek przełącznik ≠ off) | **Zrobione** | `DashboardLibraryTile` — zaplanowane dziś, przeczytanie ostatniej X / Y, odblokowania, przestrzeń |
| 7. Historia zmian z filtrem i maskowaniem adresów | **Zrobione, sprawdzone** | `HistoryPanel` + `history`; §4 S9 |
| 8. Podgląd oczami klienta (tylko odczyt, bez oznaczania, wpis w Historii) | **Zrobione, sprawdzone** | `ClientPreviewDialog`; §4 |
| 9. `libraryTick` jako workflow co 5 min z własnym tokenem | **Zrobione, sprawdzone** | `BibliotekaTick.jsonc` — aktywny, 3 udane przebiegi; token: patrz §6.1 |
| Migracja i kontrola dostępu | **Zrobione, sprawdzone** | `checkpoint` — 13 tabel, 8 funkcji, 0 naruszeń |
| Budowa aplikacji | **Zrobione** | `vite build` — kod wyjścia 0 |

---

## 2. Nowe i zmienione pliki

**Nowe — panel biblioteki:** `TargetPicker.jsx`, `MessagePreview.jsx`, `MessageForm.jsx`, `MessageRow.jsx`,
`MessagesPanel.jsx`, `TemplatesTab.jsx`, `HistoryPanel.jsx`, `GroupPanel.jsx`.
**Nowe — klienci:** `ClientMessagesBox.jsx`, `ClientPreviewDialog.jsx`.
**Nowe — pulpit:** `DashboardLibraryTile.jsx`.

**Zmienione:** `RichLite.jsx` (tryb znaczeniowy + `{imię}`), `AssignDialog.jsx` (korzysta z `TargetPicker`,
przyjmuje grupę startową), `GroupsTab.jsx` (karta grupy zamiast listy adresów), `ClientLibraryBox.jsx`
(sekcja wiadomości), `ClientsLibraryList.jsx` (akcja zbiorcza), `AdminDashboard.jsx` (kafelek),
`Admin.jsx` (sekcje `wiadomosci`, `historia`), `libApi.js` (`plToUtc`, `utcToPlInput`, `shortDate`).

**Serwer:** `libraryAdmin` — nowe akcje `message_preview`, `message_edit_sent`, `message_cancel`,
`message_delete`, `group_detail`; rozszerzone `messages_list` (liczniki), `message_send`
(limit godzinowy + promocja szkicu), `message_notify_unread` (raz na 24 h), `history` (filtr i maskowanie),
`preview_client` (wpis w Historii). `libraryNotify` — naprawiony przydział (§3.1).

**Workflow:** `base44/workflows/BibliotekaTick.jsonc` — cron `*/5 * * * *`, strefa `Europe/Warsaw`,
wywołuje `libraryTick` z tokenem zadania.

---

## 3. Błędy znalezione w trakcie testów i naprawione

### 3.1 Przydział z dołączonego materiału zapisywał pusty adres odbiorcy

`deliverMessage` czytał przy odbiorcach „osoba" pole `t.email` (pojedyncze), a definicja odbiorców trzyma
listę `t.emails`. Wiersz przydziału powstawał z pustym adresem — materiał nie trafiał do nikogo.
**Naprawione:** dla odbiorców „osoba" powstaje teraz przydział wprost dla **każdego faktycznego odbiorcy**
(jeden wiersz na osobę); dla grupy bez zmian — jeden wiersz grupowy. Potwierdzone w §4 W5 i S8.

### 3.2 Historia zmian zawsze zwracała zero wpisów

Filtr rodzaju działania czytał pole `action` samego żądania (`body.action` = „history"), więc zawężał
zapytanie do nieistniejącej akcji o nazwie „history" i zwracał pustą listę.
**Naprawione:** filtr podaje się jako `action_filter`. Potwierdzone w §4 S9.

---

## 4. Wyniki testów

### W1 — tworzenie wiadomości
Szkic z tytułem, treścią, dołączonym materiałem i kopią e-mail. Odbiorcy policzeni przez bazę: **1**.

### W2 — zmienna `{imię}`
| Wejście | Wynik |
|---|---|
| `<p>Cześć {imię}, dziękuję.</p><p>To test.</p>` — osoba z imieniem | `<p>Cześć Dawid, dziękuję.</p><p>To test.</p>` |
| ten sam tekst — adres bez konta (przez grupę) | `<p>Cześć, dziękuję.</p><p>To test.</p>` |
| podgląd przy imieniu | `wstawione imię: Dawid` |
| podgląd bez imienia | `bez imienia — zdanie dopasowane` |

### W3 — podgląd
Liczba odbiorców, wybrana osoba, treść i stała stopka: odpowiedź e-mailem, WhatsApp (gdy ustawiony),
`116 123 · 800 70 2222 (całą dobę, bezpłatnie) · 112`. Bez odbiorców → „Wybierz osobę.".
Podgląd używa tej samej ścieżki co klient: `renderBody` → `sanitizeHtml`.

### W4 — kopia e-mail „Powiadomienie bez treści"
| Sprawdzenie | Wynik |
|---|---|
| Wpisy w kolejce | 1 |
| Temat | „Masz nową wiadomość na exmortis.pl" |
| Treść wiadomości w e-mailu | **brak** |
| Status bez skonfigurowanego SMTP | `kolejka`, bez błędu |

### W5 — wysyłka i dołączony materiał
Wysłano do **1** odbiorcy. Dołączony materiał przydzielony tym samym odbiorcom — po naprawie wiersz
z właściwym adresem (`odbiorcy: 1`). Statystyki: 1 odbiorca, nieprzeczytane.

### W7 — powiadomienie do nieprzeczytanych
| Przebieg | Wynik |
|---|---|
| pierwsze wywołanie | `{ok: true, sent: 1, nieprzeczytane: 1}` |
| drugie w ciągu 24 h | „Powiadomienie do nieprzeczytanych zostało już wysłane w ciągu ostatnich 24 godzin." |

### W8 — poprawka literówki po wysłaniu
Zapis ok, wpis `wiadomosc_poprawniona` w Historii zmian, liczba wpisów w kolejce maili **bez zmian**
(czyli bez ponownego e-maila).

### Limit 20 wysłanych na godzinę
Po wykorzystaniu limitu kolejna wysyłka odmówiona komunikatem:
„Wykorzystany limit 20 wysłanych wiadomości na godzinę. Kolejną wyślesz po godzinie."
Licznik liczy wszystkie wysłane w ostatniej godzinie (także wycofane).

### Anulowanie i wycofanie
| Sprawdzenie | Wynik |
|---|---|
| Anulowanie zaplanowanej | ok — wróciła do szkiców |
| Powtórne anulowanie | „Tej wiadomości nie można już anulować — zadanie ją przejęło." |
| Wycofanie wysłanej | ok + „Wysłanego e-maila nie da się cofnąć." |

### S8 — idempotencja na zadaniu
Wiadomość zaplanowana na przeszłość, zadanie uruchomione dwa razy:

| Przebieg | Wysłane | Odbiorcy w bazie |
|---|---|---|
| pierwsze uruchomienie | 1 | 1 |
| drugie uruchomienie | 0 | 1 (bez dubli) |
| budżet zadania | 20 → 19 → 18 | — |

### S9 — Historia zmian
| Sprawdzenie | Wynik |
|---|---|
| Wpisy | 189 |
| Pełne adresy e-mail w treści wpisu | **0** |
| Adresy zamaskowane (`da***@gmail.com`) | 188 |
| Treść wiadomości w Historii | **0** |
| Filtr rodzaju działania | działa (np. `podglad_klienta` → 1 wpis) |

### Podgląd oczami klienta
Biblioteka: 1 materiał · Wiadomości: 1 · „nieprzeczytane: 0" (podgląd nic nie oznacza) · treść wiadomości
widoczna · brak podpisanych linków do plików (same kafelki) · wpis `podglad_klienta` w Historii.

### Karta grupy, kafelek pulpitu, checkpoint
| Sprawdzenie | Wynik |
|---|---|
| Karta grupy | członkowie, materiały, wiadomości do grupy — wszystkie trzy listy wypełnione |
| Kafelek pulpitu | zaplanowane dziś, przeczytanie ostatniej wysłanej (X / Y), odblokowania, zajęta przestrzeń |
| Tabele `mb_*` | 13, RLS włączone, 0 polityk, brak uprawnień `anon`/`authenticated` — **0 naruszeń** |
| Funkcje `mb_*` | 8, `EXECUTE` tylko dla `service_role` — **0 naruszeń** |
| Workflow `BibliotekaTick` | **aktywny**, 3 udane przebiegi co 5 min (10,5 s / 40,6 s / 58,7 s) |
| Budowa | `vite build` — kod wyjścia 0 |

---

## 5. Sprzątanie po testach

| Element | Stan po sprzątaniu |
|---|---|
| `mb_messages` | **0** (usunięte 25 wiadomości testowych, w tym limitowe) |
| `mb_message_recipients` | 0 (kaskada) |
| `mb_materials`, `mb_collections` | **0** |
| `mb_groups` | **4 — wyłącznie grupy startowe** |
| `mb_templates` | 0 |
| `mb_assignments` | 0 aktywnych |
| Kolejka maili | usunięte 2 wpisy powstałe w testach (`biblioteka_wiadomosc`) |
| `mb_settings` | `library_mode = off`, `messages_mode = off`, `email_notify = false`, próg 5120 MB |
| Przestrzeń modułu | **0 B / 0 plików** |
| `mb_log` | 189 wpisów **zostaje** — historia jest tylko do dopisywania; znikną po 12 mies. |

**Pliki testowe w magazynie prywatnym:** 1 plik, 59 B (z wcześniejszej tury), bez rekordu w bazie.

---

## 6. Ograniczenia i obserwacje

### 6.1 Token zadania musi być wpisany w pliku workflow
Sprawdzone w dokumentacji platformy: workflow **nie potrafi** odczytać sekretu ani wartości z bazy —
jedyna droga to odczyt sekretu **wewnątrz** funkcji serwera. Dlatego token z `mb_settings.tick_token`
jest wpisany w `BibliotekaTick.jsonc` (tak samo jak w istniejącym `RezerwacjeTick`).
Token jest osobny od tokenu rezerwacji. **Obrót:** akcja `tick_token` z `rotate: true`, potem podmiana
wartości w pliku workflow. Nie ma go w żadnym logu ani odpowiedzi API.

### 6.2 „Umów sesję"
Przycisk pojawia się tylko gdy moduł rezerwacji ≠ off i prowadzi do sekcji **Rezerwacje 1:1** — czyli do
istniejącego zapisania przez administratora. Nie zmienia niczego w logice rezerwacji ani w formularzu.

### 6.3 Usuwanie wiadomości
Dodane, bo bez tego nie da się posprzątać po testach: usunąć można **szkic i wiadomość wycofaną**.
Wysłanej się nie usuwa — tę się wycofuje. Wycofane widać w zakładce „Wysłane".

### 6.4 Widok 375 px
Nie potwierdzony wizualnie (brak narzędzia zrzutu w tej sesji). Nowe ekrany używają zawijania pasków,
jednej kolumny poniżej `sm` i przewijanych list — **do potwierdzenia w podglądzie**.

### 6.5 Podgląd a tryb modułu
Podgląd oczami klienta pokazuje materiały zgodnie z regułą widoczności — przy `library_mode = off`
biblioteka jest pusta także w podglądzie (tak działa reguła). Sprawdzone przy przełączniku w trybie
„Tylko admin", po czym przywróconym na `off`.

---

## 7. Co zostaje na etap 1C

- Strona klienta `/konto`: „Moja biblioteka" i „Wiadomości" + najnowsza nieprzeczytana w nagłówku.
- Otwieranie materiałów, postęp, podpisane linki do plików, znacznik „przeczytane".
- Podpięcie `mb_move_email` do modułu zmiany adresu (przygotowane w 1A).
- Anonimizacja RODO w Historii zmian.

Nic nie opublikowano. `base44/mcp/config.json` bez zmian. Moduły Skarbca, zakupów, Obok, spotkań,
rezerwacji i Ogłoszeń bez zmian.