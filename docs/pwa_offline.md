# Aplikacja offline (PWA) — strategia cache

Service worker: `public/sw.js`. Manifest: `public/manifest.webmanifest`. Strona bez sieci: `public/offline.html`.

## Strategie
- **Nawigacje (HTML)** — zawsze **sieć-najpierw**. Gdy jest sieć, użytkownik dostaje aktualną stronę (aktualizacje nigdy nie są blokowane). Z pamięci korzystamy dopiero przy braku sieci.
- **`/assets/*`** (pliki z hashem w nazwie) — **cache-first**; zmiana pliku zmienia jego nazwę, więc kopia nigdy się nie „zabetonuje".
- **`/fonts/*`** — **stale-while-revalidate** (szybki start z kopii, cicha aktualizacja w tle).
- **Powłoka aplikacji** (`/`) jest zapisywana przy instalacji i przy pierwszej udanej nawigacji.

## Czego service worker NIGDY nie dotyka
`/functions/*`, `/api/*`, żądania inne niż `GET`, adresy z parametrem `t=` lub `token`, wszystko związane z PayU, obce domeny (m.in. podpisane pliki `media.base44.com`), a także `/admin`, `/skaner` i `/konto`.

## Zachowanie bez sieci
1. dokładna kopia strony, jeśli była wcześniej zapisana (strony publiczne poza listą wykluczeń),
2. dla tras `/konto/rozdroza*` i `/cisza*` — powłoka aplikacji (SPA), żeby **ROZDROŻA** (historia otwarta online) i **Minutnik ciszy** działały z kopii trzymanej przez czytnik,
3. w pozostałych przypadkach — strona `offline.html` (numeru pomocowe 116 123 · 800 70 2222 · 112 oraz linki do ROZDROŻ/Minutnika, jeśli były wcześniej otwarte).

Pliki audio nie są buforowane — offline działa sam interfejs Minutnika.

## Aktualizacje i wyłącznik
- Nazwa cache zawiera wersję; przy aktywacji stare cache są usuwane, a worker od razu przejmuje karty (`skipWaiting` + `clients.claim`).
- Rejestracja następuje dopiero po zdarzeniu `load` i wyłącznie w wersji produkcyjnej (nie w trybie deweloperskim).
- Przełącznik **Ustawienia strony → Aplikacja offline** (domyślnie włączony) jest ustawieniem publicznym. Gdy wyłączony, strona przy starcie wyrejestrowuje service workera i czyści jego cache.