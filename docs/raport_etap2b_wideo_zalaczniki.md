# RAPORT — ETAP 2B: własne wideo, kilka załączników, przydział zbiorczy

12.10.2026. Baza i serwer zbudowane przez Base44 (migracja 2B wykonana); resztę dokończył Claude bezpośrednio w kodzie,
bo w Base44 skończył się miesięczny limit wiadomości AI.

## Zrobione
| Punkt | Stan |
|---|---|
| Baza: video_domains, server_url, video_provider 'plik'/'serwer', CHECK rodzaju, mb_message_attachments (≤10), przeniesienie attached_* | Base44 — migracja wykonana |
| RPC: mb_admin_settings_save, mb_admin_assign_many, mb_admin_message_attachments; zmienione mb_lib_settings, mb_client_open, mb_client_messages, mb_admin_material_save/register, mb_admin_materials, mb_admin_message_save/finish, mb_admin_messages | Base44 |
| Wgrywanie wideo MP4/M4V/WebM ≤ 100 MB, sygnatura + rozszerzenie + rozmiar; formularz z trzema źródłami | Base44 |
| save_settings: brak pola video_domains = lista bez zmian | Claude |
| message_save: brak pola attachments przy edycji = załączniki bez zmian | Claude |
| Ustawienia: pole „Domeny moich plików wideo” (+ informacja o pominiętych); naprawione pole progu GB (nie dało się go zmienić) | Claude |
| Wiadomość: „Dołącz materiały” — wyszukiwarka, wiele naraz, materiały i kolekcje, kolejność strzałkami, usuwanie, max 10 (AttachmentPicker) | Claude |
| Lista wiadomości w panelu i podgląd oczami klienta: wszystkie załączniki | Claude |
| Klient: kafelki wszystkich załączników w wiadomości (kolekcja → informacja „w zakładce Moja biblioteka”) | Claude |
| Klient: natywny odtwarzacz `<video controls playsinline preload="metadata">` dla pliku i adresu z serwera, odnawianie linku z zachowaniem pozycji, `controlsList="nodownload"` + bez menu kontekstowego przy wyłączonym pobieraniu | Claude |
| Materiały: checkboxy + „Przydziel zaznaczone (N)” → okno przydziału → assign_many, podsumowanie „N materiałów → M osób” | Claude |
| Adres z serwera: odrzucany także z loginem/hasłem w adresie i z niestandardowym portem | Claude |

## Błędy znalezione przy okazji i naprawione
- Okno przydziału przy kilku wybranych osobach przydzielało materiał **tylko pierwszej** (assignment_save brał emails[0]). Teraz: materiał → assign_many dla wszystkich; kolekcja → przydział na każdą osobę.
- Okno przydziału wysyłało daty „widoczne od/do” bez przeliczenia z czasu PL na UTC (przesunięcie o 1–2 h). Teraz plToUtc.
- „WYŚLIJ TERAZ” pomijało okno potwierdzenia przy ponad 10 odbiorcach (funkcja sendNow była nieużywana). Naprawione.

## Sprawdzone
- vite build — OK; eslint no-undef na zmienionych plikach — 0 błędów; deno lint no-undef funkcji biblioteki — 0.
- Walidacja adresu z serwera (deno): poprawne https z listy — przyjęte; http, obca domena, javascript:, IP, „domena.evil.com”, domena w ścieżce, .mov, login w adresie — odrzucone.
- Sygnatury: MP4 (ftyp) i WebM przyjęte, HTML odrzucony.

## Niesprawdzone (wymaga konta admina — po publikacji, ręcznie)
- Wgranie prawdziwego pliku MP4 i odtworzenie na telefonie.
- Wiadomość z 3 załącznikami → odbiorca widzi 3 kafelki i ma 3 przydziały; ponowne wysłanie bez dubli.
- Przydział 3 materiałów 2 osobom jednym kliknięciem.
