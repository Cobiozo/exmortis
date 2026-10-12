# Funkcje serwera (Base44, Deno)

> Plik generowany skryptem z kodu (docs/tech/generuj.mjs) — po zmianach uruchom ponownie: `node docs/tech/generuj.mjs`.

Adres: `https://exmortis.pl/functions/<nazwa>` (POST, JSON; z przeglądarki przez `base44.functions.invoke`). Kod: `base44/functions/<nazwa>/entry.ts`, wspólne moduły: `base44/shared/`.

| Funkcja | Do czego | Dostęp | Akcje (body.action) | Wywoływana z |
|---|---|---|---|---|
| adminClients | Panel klientów: lista, szczegóły, ręczne nadanie / przedłużenie / odebranie dostępu. | admin | list, detail, security, unblock, find, grant, extend, revoke, restore | 6 plików front |
| adminContent |  | admin | list, save, delete | 2 plików front |
| adminDashboard |  | admin | contacts | 2 plików front |
| adminNewsletter | Moduł newslettera: grupy odbiorców, kampanie i wysyłki przez SMTP. | admin |  | 3 plików front |
| adminOrders | Panel admina: zamówienia ze Skarbca (lista, podsumowanie, oznaczanie wystawionych faktur). | admin | list, invoice_issued | 1 plików front |
| adminProducts | Tekst opcjonalny → NULL; obcięty do max. | admin | list, save, delete | 4 plików front |
| adminQuiz | Wyniki testu "Która śmierć jest Twoja?" dla panelu administratora: | admin | stats, list | 1 plików front |
| adminSettings | Rola techniczna nie widzi listy adresów z dostępem przedpremierowym. | admin | get, save, zoom_get, zoom_save, video_get, video_save, video_new_key, video_sign_preview, delete | 10 plików front |
| adminSubscribers |  | admin | list, save, delete | 1 plików front |
| announcements | Ogłoszenia na koncie — wyłącznie na stronie (bez e-maili). | admin / zalogowany | mine, event, list, options, save, publish, end, duplicate, delete | 1 plików front |
| bookingAdmin | Panel rezerwacji 1:1 — wyłącznie administrator. Jedyne miejsce odszyfrowania odpowiedzi o zdrowiu. | admin |  | 3 plików front |
| bookingPublic | Publiczne rezerwacje 1:1. Zwraca wyłącznie godziny i dane potrzebne formularzowi — nigdy linku Zoom ani cudzych danych. | admin / zalogowany |  | 9 plików front, 2 zad. cykl. |
| bootstrap | Jedno wywołanie startowe gościa: ustawienia + treści + strona z edytora + spotkanie. | publiczna |  | 1 plików front, 1 zad. cykl. |
| checkDiscount | Podgląd rabatu w kasie (ostateczne wyliczenie i tak robi payuCreateOrder). | publiczna |  | 1 plików front |
| cmsScheduled | Publikuje strony zaplanowane na termin, który już minął (wywoływane cyklicznie). | publiczna |  | 0 plików front, 1 zad. cykl. |
| course | Kurs klienta: spis lekcji, podpisany link do wideo (po sprawdzeniu dostępu), postęp. | zalogowany | outline, play, violation, progress | 2 plików front |
| createContactMessage | Pole-pułapka: ludzie go nie widzą, boty je wypełniają. Udajemy sukces. | publiczna |  | 2 plików front |
| createPodcastApplication |  | publiczna |  | 1 plików front |
| createPowrotApplication | Nowe kolumny formularza kwalifikacyjnego (tele jest zgodne z encją PowrotApplication). | publiczna |  | 1 plików front |
| emailChange | Zmiana adresu e-mail konta — wyłącznie z panelu administratora. Osobny moduł: | admin | check, submit, tick, settings, log, aliases, state, start, plan, transfer, backup, restore | 2 plików front, 1 zad. cykl. |
| eventShare | Link do udostępniania spotkania: HTML z og:image/og:title/og:description | publiczna |  | 0 plików front |
| eventsAdmin | Administracja wydarzeniami: lista, szczegóły z uczestnikami, zapis/edycja, | admin | list, get, save, duplicate, repeat, cancel, promote, delete, present, broadcast | 5 plików front |
| eventsCancel | Link „Nie mogę przyjść — zwalniam miejsce" z e-maili: oznacza zapis jako | publiczna |  | 0 plików front |
| eventsPublic | Start zapisów na wybrane spotkania (adres spotkania → chwila otwarcia). Na stronie to samo pole: | admin / zalogowany | list, get, register, join, ics, flush, remind, tick | 10 plików front, 4 zad. cykl. |
| gdprPerson | RODO art. 15 i 17: znajdź / wyeksportuj / usuń dane osoby po e-mailu — w Supabase i w bazie aplikacji naraz. | admin / zalogowany | powrot, find, export, delete | 2 plików front |
| instagramFeed | Zwraca najnowsze posty z Instagrama (profil podłączony przez connector). | publiczna |  | 1 plików front |
| library | Strona klienta: „Moja biblioteka" i „Wiadomości". | admin / zalogowany |  | 1 plików front |
| libraryAdmin | Panel biblioteki i wiadomości. Wyłącznie rola „admin" (konto techniczne nie ma dostępu), | admin |  | 4 plików front |
| libraryTick | Zadanie serwera: wysyłka zaplanowanych wiadomości (idempotentnie), zbiorcze powiadomienia | admin / zalogowany |  | 0 plików front, 1 zad. cykl. |
| mailAdmin | Ustawienia → Wysyłka e-mail: konfiguracja SMTP, test, status, kolejka zaległych, dziennik, DNS. | admin | status, save, test, dns, log, flush | 5 plików front |
| media | Proxy obrazów z prywatnej biblioteki: sprawdza pochodzenie, limit żądań, zwraca wersję WebP z cache przeglądarki. | publiczna |  | 1 plików front |
| myAccount | Konto klienta: moje produkty, zakupy, podpisany link do pliku (po sprawdzeniu dostępu). | zalogowany | products, orders, file | 3 plików front |
| myEvents | Moje konto → Spotkania: zapisy zalogowanej osoby (po adresie e-mail) i nagrania. | admin / zalogowany | list, play, violation | 2 plików front |
| mySettings | Ustawienia konta klienta: Listy powrotu (stan z bazy), eksport i usunięcie własnych danych. | admin / zalogowany | listy, listy_on, listy_resend, listy_off, export, delete | 3 plików front |
| obok | Strefa Obok: dostęp, harmonogram i pliki sprawdzane na serwerze. | admin / zalogowany | unsub, public, home, join, notify, leave, seria, nagranie, progress | 3 plików front |
| orderFree | Zamówienie bezpłatnego materiału: zapis zgód (z datą i godziną), | publiczna |  | 1 plików front |
| payuCreateOrder | Strona powrotu z PayU pyta o stan: tylko status, po losowym numerze zamówienia (UUID), bez danych osobowych. | publiczna | status | 1 plików front |
| payuNotification | KROK 2: „Rozmowa na progu” — zakup produktu wskazanego w panelu zakłada pakiet sesji. | publiczna |  | 0 plików front |
| rozdroza | ROZDROŻA dla zalogowanego klienta: tylko opublikowane, sprawdzone kopie historii (nigdy szkice). | admin / zalogowany | list, story | 2 plików front |
| rozdrozaAdmin | ROZDROŻA — administracja (tylko rola admin): import z JSON, okładki i obrazy scen, | admin |  | 2 plików front |
| shopProducts | Publiczny katalog Skarbca: produkty dostępne i "wkrótce", posortowane po poziomie drabiny. | publiczna | curriculum | 6 plików front |
| shopQuizSubmit | Publiczne przesłanie testu "Która śmierć jest Twoja?": zapis pełnego wyniku, | publiczna |  | 1 plików front |
| shopWaitlist | Publiczny zapis na listę oczekujących przy produkcie "wkrótce". | publiczna |  | 1 plików front |
| silenceAdmin | Administracja Minutnikiem ciszy: pliki audio (ustawienia) i anonimowe statystyki. | admin | get, save, stats30, stats | 2 plików front |
| silenceSession | Publiczny, anonimowy zapis zdarzenia ciszy: cisza_start / cisza_ukonczona (bez danych osobowych). | publiczna |  | 1 plików front |
| siteContent | Publiczne odczyty treści stron — z kopii w bazie aplikacji, odświeżanej z Supabase w tle. | publiczna |  | 1 plików front |
| siteSettings | Publiczne ustawienia strony: dane firmy i tryb przedpremierowy. | publiczna |  | 4 plików front |
| sitemap | Mapa strony dla wyszukiwarek (https://exmortis.pl/functions/sitemap, wpisana w robots.txt). | publiczna |  | 0 plików front |
| subscribeNewsletter | Publiczne zapisy do newslettera „Listy powrotu" + potwierdzenie z linku (double opt-in). | publiczna | confirm | 4 plików front |
| webinarSignup | Publiczne zapisy na webinar 1 listopada („Ze śmierci"). | publiczna |  | 0 plików front |
| withdrawal | Odstąpienie od umowy online — bez logowania, potwierdzenie e-mailem z datą i godziną wpływu. | publiczna |  | 1 plików front |
