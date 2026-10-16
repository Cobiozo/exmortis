# Audyt QA — moduł OBOK i drugi przebieg po Podcaście/Głosie (2026-10-16)

Kontynuacja audytu z raportu `audit_glos_podcast_2026-10-16.md` — ostrzeżenia z tamtego raportu wprowadzone wcześniej; ta runda obejmuje strefę Obok (strony, konto, panel) i uzupełniający przebieg po Głosie.

## Naprawione — OBOK

1. **Systemowe okienko przy opuszczaniu serii** — `window.confirm` w koncie (Obok) zamienione na potwierdzenie w miejscu (TAK / NIE), zgodnie z decyzją marki z poprzednich rund.
2. **Reset postępu wideo przez samo otwarcie strony** — przy wyjściu ze strony nagrania zapisywano pozycję odtwarzacza nawet, jeśli wideo w ogóle nie wystartowało (0 s nadpisywało zapisaną pozycję). Teraz zero nie nadpisuje postępu.
3. **Pusty kafelek serii bez nagrań** — seria w statusie „aktywna" bez ani jednego nagrania pokazywała się zwykłym użytkownikom jako kafelek „0 z 0" z pustą listą. Teraz taka seria nie wyświetla się (administrator widzi ją nadal).
4. **Seria testowa dostępna z zewnątrz** — „TEST — nie publikować" była aktywna, więc dało się do niej dołączyć z bezpośredniego adresu; przełożona na szkic (dane, nie kod).
5. **Opuszczanie serii sypało setkami zapytań** — usuwanie postępu robiło pętlę po pojedynczych rekordach (do 500 wywołań); teraz jedno operacja zbiorcza.
6. **Wczytanie kafelków Obok: para zapytań na serię** — przy wielu seriach baza dostawała 2+N zapytań na jedno wejście; teraz dwa zbiorcze zapytania na wszystkie serie (nagrania + odsłuchy) i składanie po stronie serwera.
7. **Brak szkieletu ładowania na kafelkach** — kafelki serii pokazywały tekst „WCZYTUJĘ…", reszta Obok używa szkieletów (wcześniejsza decyzja); teraz spójny szkielet kafelka (działa z preferencją ograniczonego ruchu).

## Naprawione — podcast (drugi przebieg)

8. **Licznik odtworzeń gubił równoległe starty** — odczyt-odtworzenie-zapis (`+1` w przeglądanych danych) nadpisywał licznik przy dwóch odtworzeniach naraz; teraz inkrementacja w bazie ($inc), bez utraty odtworzeń.

## Zweryfikowane, bez zmian

- Dostęp: wszystko sprawdzane na serwerze (funkcja Obok) — lista i nagranie wymagają zalogowania, przynależności lub posiadania produktu; nagranie otwarte wyłącznie w oknie harmonogramu; szkic lub nagranie bez pliku nie odblokuje się nigdy; podpisany link pliku wygasa po 3 h.
- Harmonogram odblokowań (sekwencja / cotygodniowa / zbiór, czas polski, tryb testowy w minutach) — spójny między listą, kafelkiem i serią.
- Odsłuchy: zapis postępu co 15 s i przy wyjściu, ukończenie przy ≥ 90% długości; nieudsłuchane po powrocie wznawiane od miejsca; opuszczenie serii czyści postęp.
- Odtwarzacz: nagrania Obok grają w jednym, współdzielonym odtwarzaczu strony z podcastem (mini‑odtwarzacz, Media Session, prędkość odtwarzania); wejście na /cisza pauzuje.
- Ochrona: blokada menu kontekstowego, zakaz pobierania wideo, tekst transkrypcji bez zaznaczania.
- Bezpieczeństwo materiałów: wylogowanie ze strefy ukrywa treści (401 → ekran logowania z powrotem); odwołanie powiadomień linkiem z e-maila działa bez logowania, token jednorazowo walidowany.
- Formularz zgłoszenia do serii i strona publiczna serii zwracają tylko nazwę, krótki opis i datę startu (bez nagrań).
- Głos (drugi przebieg): listy odcinków i filtr tematów, fragmenty czasowe (rozdziały), przełącznik audio/wideo, zapowiedzi Spotify/YouTube, ostrzeżenie o trudnych tematach z numerami kryzysowymi, SEO odcinka (JSON-LD, czyszczenie po wyjściu), kanały subskrypcji — bez uwag.

## Ostrzeżenia (bez zmian w kodzie)

- **Panel Obok nie potwierdza zapisu**: formularz serii i nagrań zapisuje bez widocznego potwierdzenia — do rozważenia krótki komunikat „Zapisano" jak w innych panelach.
- **Okładki serii puste** — kafelki bez okładki pokazują samą nazwę na ciemnym tle; działa, ale obrazy poprawią odbiór (spójne z „Niespójności w danych produktów" z rejestru).
- **Zapis pozycji audio przy wyjściu zależy od odtwarzacza globalnego** — jeśli użytkownik zamknie kartę, ostatnie ≤ 15 s może nie zostać zapisane (zapis co 15 s i przy przejściu na inną stronę); akceptowalne dla nagrań 5–15 min.