# RAPORT — ETAP 1C (strona klienta i domknięcie modułu)

Zakres: zakładki „Moja biblioteka" i „Wiadomości" na /konto, nagłówek konta z nieprzeczytaną
wiadomością, przeniesienie adresu e-mail w tabelach biblioteki, RODO dla tabel `mb_*`.
Bez publikacji, bez zmian w Skarbcu, zakupach, checkoucie, Obok, spotkaniach, /dolacz,
rezerwacjach i Ogłoszeniach. `base44/mcp/config.json` nietknięty.

## 1. Co powstało

| Obszar | Pliki |
|---|---|
| Wejście do modułu | `base44/functions/library/entry.ts` (akcja `config` przeniesiona przed blokadę 404, `open_material` zwraca `allow_download` i `external` dla linku) |
| Stopka wiadomości | `base44/shared/libraryAccess.ts` — `footerData` bierze adres z **Danych firmy**, nie od klienta; `libraryView.ts` dokłada tytuł dołączonego materiału |
| Zakładki /konto | `src/pages/Account.jsx` (zakładki dokładane warunkowo), `src/components/account/library/libApi.js` |
| Moja biblioteka | `MyLibrary.jsx`, `LibraryTile.jsx`, `MaterialSheet.jsx`, `AudioPlayer.jsx`, `VideoFacade.jsx`, `LeaveDialog.jsx` |
| Wiadomości | `MyMessages.jsx`, `MessageCard.jsx`, `MessageFooter.jsx`, `AccountUnreadMessage.jsx` |
| Zmiana adresu | `base44/functions/emailChange/entry.ts` — `mb_move_email` w try/catch |
| RODO | `base44/shared/gdpr.ts` + `base44/shared/librarySchema.ts` (funkcja `mb_log_anonymize`) |

## 2. Zachowanie przy wyłączonych modułach (B1)

`/konto` wygląda dokładnie jak dotąd. Jedno lekkie wywołanie `config` (odczyt przełączników z 30-sekundową
pamięcią w instancji + dane firmy z pamięcią 60 s). `bootstrap` **nie był zmieniany**, więc jego czas
odpowiedzi jest identyczny jak przed etapem — nie ma tam skąd wziąć przełączników bez rozszerzania
publicznej odpowiedzi o informacje o module.

- oba „off" → `config` zwraca `{library:false, messages:false}`; żadna zakładka się nie pokazuje,
  nagłówek konta nie woła `unread` (komponent nie jest renderowany).
- `library_mode: "admin"` → `mb_visible_materials(..., p_admin=false)` zwraca 0 wierszy, czyli zwykłe
  konto nie widzi nic; panel administracyjny działa jak dotąd.

## 3. Dowody z testów

**B1 — „admin": zwykłe konto nic nie widzi**
```
mb_visible_materials(test, false) przy library_mode='admin'  → 0
mb_visible_materials(test, true)  przy library_mode='admin'  → 1
mb_visible_materials(test, false) przy library_mode='on'     → 1
```

**S2 — `my_library` (odpowiedź funkcji, materiał testowy):**
```json
{"items":[{"id":"…","title":"Materiał testowy 1C","kind":"TEKST","description":"opis",
"duration_s":null,"pages":null,"stage":"Etap 1","tags":[],"note":"notatka testowa",
"visible_from":null,"visible_to":null,"collection_id":null,"position":0,
"opened_at":null,"completed_at":null,"has_file":false,"allow_download":false,
"text":"<p>Treść testowa</p>"}],
"collections":[],"counts":{"AUDIO":0,"WIDEO":0,"PDF":0,"LINK":0,"TEKST":1},"unopened":1}
```
Brak `file_key`/`file_uri`, brak nazw grup, brak list odbiorców, brak statystyk.

**S3 — `my_messages` (odpowiedź funkcji):**
```json
{"items":[{"id":"…","title":"Wiadomość testowa 1C","text":"<p>Cześć Dawid, to test.</p>",
"sent_at":null,"read_at":null,"material_id":null,"collection_id":null,
"material_title":null,"material_kind":null,"collection_title":null}],"unread":1}
```
Znacznik `{imię}` podstawiony, `{imię}` bez imienia znika razem z odstępem.

**S4 — limit wydawania linków:** 31. wywołanie `mb_link_hit` w ciągu godziny → `rate`
(funkcja `library` zwraca wtedy 429 „Zbyt wiele odświeżeń"). Podpisany link ma 10 min (PDF) /
60 min (audio) i jest odnawiany przez `refresh_link` przed wygaśnięciem oraz po błędzie odtwarzania.

**B6 — przeniesienie danych biblioteki przy zmianie adresu:**
```
przed: grupy=1 przydziały=1 stany=1
mb_move_email(test-b6@… → test-b6-new@…)
       → {"ok":true,"przeniesione":{"grupy":1,"przydzialy":1,"stany":1,"odbiorcy":0,"wyjatki":0}}
po:    stary adres 0/0/0 · nowy adres 1/1/1
historia zmian: actor=system action=zmiana_adresu summary="dane biblioteki przeniesione" (bez adresów)
```
Krok jest w `try/catch` — błąd biblioteki nie blokuje zmiany adresu, a nieudane przeniesienie
zostawia wpis `biblioteka_blad` bez pełnych adresów.

**B7 / S10 — RODO:** eksport osoby obejmuje grupy, przydziały wprost, stan materiałów i treść
otrzymanych wiadomości; usunięcie kasuje te wiersze kaskadowo (przydziały grupowe zostają — nie są
danymi osoby); wpisy historii dotyczące osoby są anonimizowane:
```
mb_log_anonymize('test-1c@example.invalid') → 3
przed: actor='test' summary='test dotyczy test-1c@example.invalid' anonymized=false
po:    actor='test' summary='test dotyczy [usuniete]'              anonymized=true
```

**B7 — poprawka wykryta w testach (ważne):** `mb_log` ma włączone RLS bez polityk, a `mb_log_maint`
nie jest właścicielem tabeli, więc nie widziała **ani jednego wiersza** — `UPDATE` w funkcji
anonimizującej i w `mb_log_purge` cicho nic nie robił (błąd istniał już od 1A).
Naprawione: `ALTER ROLE mb_log_maint BYPASSRLS` (dopisane do `librarySchema.ts`, więc migracja
zachowa to także przy odtworzeniu bazy). Po naprawie anonimizacja działa (3/3 wiersze).
Sprawdzenie po migracji: `mb_log` nadal `polityki = 0`, `anon`/`authenticated` bez uprawnień.

## 4. RODO — zakres i granice

- Eksport JSON: grupy ręczne, przydziały wprost, stan materiałów, treść wiadomości otrzymanych.
- Usunięcie: kaskadowo te same wiersze. **Zostają:** przydziały grupowe i historia zmian
  (zanonimizowana) — to nie są dane osobowe, a historia jest dowodem działań administratora.
- Pozostała logika RODO bez zmian.

## 5. Polityka prywatności — proponowany fragment (dokumentu nie zmieniano)

> **Materiały i wiadomości w Twoim koncie**
> Jeśli udostępniamy Ci materiały (nagrania, pliki PDF, filmy, teksty) albo piszemy do Ciebie
> wiadomości, zapisujemy: Twój adres e-mail, informację, kiedy materiał został otwarty i czy został
> oznaczony jako ukończony, oraz datę przeczytania wiadomości. Pliki przechowujemy w prywatnym
> magazynie — dostęp do nich wydajemy na krótko, wyłącznie po zalogowaniu. Nie profilujemy Cię
> i nie przekazujemy tych informacji nikomu. Materiały i wiadomości usuwamy razem z Twoim kontem
> albo wcześniej, na Twoje żądanie. Filmy otwierane są dopiero po Twoim kliknięciu — wtedy serwis
> zewnętrzny (YouTube, Vimeo, Bunny) może zapisać własne pliki cookies.

## 6. Gotowe do publikacji / blokery

**Gotowe:** wszystkie punkty 1–8 zakresu. `npx vite build` przechodzi bez błędów.
Przełączniki wróciły na „off" (`library_mode='off'`, `messages_mode='off'`, `email_notify=false`).

**Blokery przed włączeniem modułu dla klientów:**
1. **SMTP** — bez skonfigurowanej wysyłki powiadomienia o materiałach czekają w kolejce (`MailQueue`),
   nic nie ginie, ale też nic nie dojdzie.
2. **WhatsApp** — pole puste, więc przycisk „WhatsApp" się nie pokazuje. Trzeba wpisać adres
   w formacie `https://wa.me/…` w ustawieniach modułu.
3. **Adres kontaktowy exmortis** — jeśli w Danych firmy pole e-mail jest puste, stopka używa
   adresu zapasowego `kontakt@exmortis.pl`. Warto potwierdzić, że to właściwa skrzynka.
4. **Migracja** — po wgraniu tego etapu trzeba raz uruchomić `migrate` w panelu biblioteki,
   żeby powstała funkcja `mb_log_anonymize` i rola `mb_log_maint` dostała `BYPASSRLS`.
   (W tej instancji obie zmiany zostały już zastosowane.)

**Uwagi:**
- Odtwarzacz audio: link wygasa (60 min), odnawiany automatycznie; przy długich nagraniach
  użytkownik może zobaczyć krótką przerwę w odtwarzaniu.
- Limit 20 wysłanych wiadomości na godzinę — celowo, chroni skrzynkę klientów.
- Historia zmian trzyma wpisy 12 miesięcy; usunięte dane osobowe pozostają w niej zanonimizowane.