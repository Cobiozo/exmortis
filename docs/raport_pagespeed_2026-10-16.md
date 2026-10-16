# PageSpeed — wydajność mobilna (2026-10-16)

Wynik wyjściowy (mobile): **88/100** — FCP 2,0 s · LCP 3,5 s · TBT 0 ms · CLS 0,026 · SI 3,6 s.

## Co blokuje wynik

- **LCP 3,5 s** — to nie samo zdjęcie (hero waży tylko 26 KB w WebP, ma preload i fetchpriority=high). Opóźnienie bierze się z przejęcia strony przez aplikację: skrypt startowy czekał na zdekodowanie zdjęcia powłoki, dopiero POTEM zgłaszał pobranie JavaScriptu (~170 KB w 32 plikach) i arkusza — aplikacja namalowywała to samo zdjęcie ponownie dopiero ~3,4 s, a to jej malowanie liczy się jako LCP.
- TBT 0 i CLS 0,026 — bez zarzutu; kod i wcześniejsze optymalizacje (powłoka startowa, krytyczny CSS, czcionki w HTML) działają.

## Zrobione

- **Skrypt startowy**: pobieranie JS (modulepreload) i pełnego arkusza CSS rusza teraz natychmiast (nakłada się ze zdjęciem i czcionkami), a uruchomienie aplikacji nadal czeka na zdekodowanie zdjęcia powłoki (bezpiecznik 1,5 s). Oczekiwany zysk: LCP i SI o ~0,7–1 s krócej, FCP bez zmian. W razie regresji zmiana cofa się jedną linijką (wywołania `pre();loadCss()` wracają do wnętrza `go()`).
- Zweryfikowano budową: boot w wygenerowanym HTML ma nową kolejność.

## Sprawdzone i bez zmian

- HTML dokumentu: 30 KB (brotli) — szybki; TTFB ~100 ms z Polski (warszawska sieć), Cloudflare bez cache (DYNAMIC) — strona serwera nie jest wąskim gardłem.
- Zdjęcie hero: 26 KB (w_960), cache 30 dni, ten sam adres w powłoce i aplikacji (bez podwójnego pobrania); podgląd rozmyty w tle.
- Czcionki: wszystkie ładowane pliki potrzebne na pierwszym ekranie (Inter 48 KB latin, Cinzel 26 KB — preload, Space Mono 17 KB), `font-display: swap`.
- JS: TBT 0 ms — nie ma zadań blokujących; podział paczek (ikony w jednym pliku) działa.
- CLS 0,026 — powłoka i aplikacja mają tę samą strukturę.

## Ostrzeżenia (poza zasięgiem aplikacji)

- **Czas życia cache: czcionki, logo i kilka plików mają TTL 1 h** (PSI: „Use efficient cache lifetimes", ~120 KB oszczędności przy powtórnych wizytach, nie liczy się do wyniku). Nagłówki cache plików publicznych ustawia platforma (zasoby budowane dostają 7 dni) — z aplikacji nie da się tego nadpisać.
- W `public/fonts/` leży ~345 KB nieużywanych plików czcionek (starsze wersje) — przeglądarka ich nie pobiera, to tylko balast w wdrożeniu; do usunięcia przy okazji, bez wpływu na wynik.