# Audyt QA — moduł GŁOS i podcast (2026-10-16)

Zakres: /glos (playlisty, podcast, zostań gościem), /glos/:slug (odcinek), mini‑odtwarzacz globalny, panel podcastu (odcinki, playlisty, goście, ustawienia), encje Utwor / PodcastEpisode / PodcastPlaylist / PodcastGuest / PodcastApplication.

## Naprawione

1. **Licznik odtworzeń nigdy nie rósł** — panel pokazywał „X odtworzeń", ale nic nie zapisywało tej wartości (RLS odcinków pozwala zapisywać tylko administratorowi). Nowa wąska funkcja `podcastPlay` zlicza starty (maks. 30/godz. z IP); licznik rośnie przy starcie nowego odcinka, wznowienie nie liczy się drugi raz.
2. **Lista odcinków dociągała pełne transkrypcje** — `loadPublished` pobierał transkrypcje aż 200 odcinków tylko po to, by wyszukiwarka mogła w nich szukać (megabajty przy każdej wizycie na /glos). Teraz lista bierze się bez transkrypcji, a szukanie obejmuje tytuły, gości i krótkie opisy (placeholder zaktualizowany).
3. **Odcinek bez nagrania renderował pusty obszar** — teraz pojawia się „Nagranie pojawi się wkrótce." (spójne ze statusem WKRÓTCE w lekcjach).
4. **Wyścig w odtwarzaczu YouTube (Głos)** — zmiana utworu zanim doładuje się API YouTube grała stary utwór; teraz tworzenie playera bierze najnowsze ID z ref‑a.
5. **Utwory z nieprawidłowym linkiem** wysypywały playlistę (puste ID → zepsuta miniatura i cichy player); teraz są odfiltrowywane przy wczytaniu.
6. **„Kontynuuj od X" pokazywało się też przy odcinku, który już gra** — teraz tylko dla odcinka nieaktywnego.
7. **Panel: systemowe okienko `window.confirm` przy usuwaniu odcinka** zamienione na potwierdzenie w miejscu (jak w zarządzaniu playlistą i rezerwacjach).
8. **Panel: błąd zapisu odcinka wywalał aplikację do ErrorBoundary** — teraz komunikat przy przycisku.
9. **Myląca ikona**: potwierdzenie usunięcia utworu miało ikonę dyskietki (Save) — teraz kosz (Trash2), spójnie z panelem odcinków.
10. **Czytelność błędów**: komunikaty w zapisie na Listy (QuietSignup) i formularzu gościa podcastu dostały `role="alert"` — czytniki ekranu odczytają je od razu.

## Zweryfikowane, bez zmian

- Zgłoszenie gościa podcastu: walidacja serwera (200–2000 znaków, zgody, limity 3/h z IP), maile do kandydata i admina (w tym wariant pilny z numerami 116 123 · 800 70 2222 · 112), historii statusów.
- Statusy publikacji: „zaplanowany" z datą w przyszłości nie wycieka na stronę publiczną; brak zgody gościa (forma pełna / ze zdjęciem, bez podpisu) blokuje publikację.
- HTML notatek przechodzi przez `sanitizeHtml`; transkrypcja renderowana jako czysty tekst.
- Cisza: wejście na /cisza pauzuje podcast i chowa mini‑odtwarzacz; pozycja zapisywana co 5 s, koniec czyści zapis.
- Udostępnianie: link z `?src=`, kopiowanie „od momentu", WhatsApp/Facebook/Messenger.

## Runda 2 (2026-10-16) — ostrzeżenia przeniesione do napraw

1. **Wyciek zaplanowanych odcinków** — strona odcinka brała rekord tylko po slugu, więc odcinek „zaplanowany" z datą w przyszłości był dostępny pod bezpośrednim adresem, choć nie na liście. Teraz odcinek pobiera się na tych samych warunkach co lista: status opublikowany/zaplanowany i data publikacji już nadeszła (ostrzeżenie 3 z listy niżej).
2. **Pętlanie playlisty Głosu** — po ostatnim utworze playlista wracała na pierwszy i grała w nieskończoność; teraz zatrzymuje się na ostatnim utworze (ostrzeżenie 2).
3. **Messenger na desktopie** — link `fb-messenger://` otwierał się tylko z aplikacją Messenger (telefony); na komputerze przycisk kopiuje link odcinka do schowka (ostrzeżenie 1).

Do decyzji (bez zmian): panel nadal nie ma podglądu odcinka przed publikacją; administrator nie podejrzy zaplanowanego odcinka pod publicznym adresem (zabezpieczenie z punktu 1 dotyczy wszystkich).

## Ostrzeżenia (bez zmian w kodzie)

- **Messenger na desktopie**: link `fb-messenger://` działa tylko na urządzeniach z aplikacją Messenger; na komputerze nic się nie otworzy — do rozważenia podmiana na adres www.
- **Playlisty odtwarzają się w pętli**: po ostatnim utworze wraca pierwszy i gra dalej — jeśli to nie zamierzone, zatrzymać na ostatnim.
- **Klasyfikacja "zaplanowany" zaliczona do read RLS z warunkiem daty** — działa, ale wymaga pilnowania, by żaden odcinek z datą w przeszłości nie został przypadkiem w statusie szkicu przy przenoszeniu.
- Panel podcastu nie pokazuje podglądu odcinka przed publikacją (edycja tylko przez formularz) — do decyzji.