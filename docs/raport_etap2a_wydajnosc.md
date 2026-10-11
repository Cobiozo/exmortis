# RAPORT — ETAP 2A: wydajność biblioteki i wiadomości

12.10.2026 · spisane przez Claude na podstawie dwóch tur Base44 i własnego przeglądu kodu.

## Przyczyna
Moduł wykonywał prawie wszystkie zapytania przez Supabase Management API (`runSql`), po kolei, ok. 1,5 s każde.
Wejście na /konto robiło 3–4 osobne wywołania funkcji.

## Zmiany
- Ścieżki częste przeniesione na PostgREST RPC: funkcje bazy `SECURITY DEFINER`, `search_path=''`, `EXECUTE` tylko `service_role`, jedna funkcja na akcję, parametry bez sklejania SQL.
- Klient: `bundle` (przełączniki + biblioteka + wiadomości + nieprzeczytane w jednym), `open_material` / `refresh_link`, `mark_completed`, `read_message`, `hide_message`.
- Panel: `settings`, `dashboard`, `materials_list`, `collections_list`, `groups_list`, `clients_list`, `client_detail`, `group_detail`, `history`, `assignment_preview`, `assignment_save/bulk/revoke`, `group_members_add/remove`, `messages_list`, `message_preview/save/send/edit/cancel/delete/withdraw/notify/stats`, szablony, `material_save/register/impact`.
- `library/entry.ts` (Claude): sesja, ustawienia i treść żądania równolegle; `bundle`/`config` przy obu modułach niedostępnych odpowiada bez zapytań do bazy.
- Front /konto: jedno wywołanie `bundle` równolegle z resztą konta; szkielety ładowania.
- W `libraryAdmin` zostało 33 wywołań `runSql` w rzadkich akcjach (migracja, kontrola, część zapisów grup i kolekcji).

## Pomiar (ms, mediana)
| ścieżka | przed (zimny) | po (ciepły) |
|---|---|---|
| bundle (zastępuje config + biblioteka + wiadomości + unread) | 3086 + 4083 + 1622 + 1603 | 178 |
| settings | 2880 | 174 |
| dashboard | 3332 | 172 |
| materials_list | 3691 | 170 |
| groups_list | 3359 | 175 |
| clients_list | 5245 | 182 |
| messages_list | 3904 | 169 |
| client_detail | — | 363 |
| open_material (bez podpisu linku) | 3404 | 222 |
| assignment_preview | — | 167 |
| auth.me | — | 46 |

Zimny start instancji: pierwsze `rpc()` pobiera klucz przez Management API — ok. 1,5 s jednorazowo na instancję.
Podpis linku do pliku niezmierzony (brak materiału z plikiem w bazie).

## Testy po zmianie
- S2, S3: kształt odpowiedzi bez zmian (bez kluczy plików, nazw grup, list odbiorców, statystyk).
- S6: sanityzacja w podglądzie wiadomości działa.
- S8: drugie przejęcie tej samej wiadomości = odmowa.
- S1: osoba testowa (nie-admin) widziała 0 materiałów — to poprawne zachowanie, bo moduł stał w trybie „admin” (mb_visible_materials: `library_mode='admin' AND p_admin`). Do powtórzenia w trybie „on” przed udostępnieniem klientom.

## Build
`vite build` przechodzi; brak niezdefiniowanych identyfikatorów w funkcjach biblioteki (deno lint no-undef).
