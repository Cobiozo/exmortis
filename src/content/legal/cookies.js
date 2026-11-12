// Polityka cookies — wersja z 9.11.2026: osobna zgoda na treści zewnętrzne (COOKIES_VERSION 2.0 w seller.js).
export const BANNER_TEXT =
  "Używamy plików cookies niezbędnych do działania strony. Za Twoją zgodą — także analitycznych, marketingowych (piksel Meta) i treści zewnętrznych (YouTube, Spotify). Możesz zaakceptować, odrzucić lub wybrać ustawienia — i zmienić zdanie w każdej chwili („Ustawienia cookies” w stopce).";

export const BANNER_TEXT_SHORT = "Używamy cookies niezbędnych do działania strony. Analityczne, marketingowe i treści zewnętrzne — tylko za Twoją zgodą.";

// Faktyczna pamięć przeglądarki używana przez aplikację (sprawdzone w kodzie).
export const COOKIE_TABLE = [
  ["exm_supa_session, exm_auth_user", "exmortis", "Niezbędne", "Utrzymanie zalogowania (localStorage)", "Do wylogowania"],
  ["exm_auth_return, exm_login_via, exm_pending_reg", "exmortis", "Niezbędne", "Powrót na właściwą stronę po logowaniu lub rejestracji (sessionStorage)", "Do zamknięcia karty"],
  ["exm_cookie_consent", "exmortis", "Niezbędne", "Zapamiętanie wyboru cookies, jego daty i wersji polityki (localStorage)", "12 miesięcy albo do zmiany polityki"],
  ["exmortis_cart, exm_payu_order, exm_payu_value", "exmortis", "Niezbędne", "Koszyk i powrót z płatności (localStorage)", "Do opróżnienia koszyka lub zakończenia płatności"],
  ["exm_outbox", "exmortis", "Niezbędne", "Kopia formularza kontaktu lub zapisu, gdy serwer chwilowo nie odpowiada — wysyłana ponownie i usuwana (localStorage)", "Do wysłania"],
  ["exm_c_*", "exmortis", "Niezbędne", "Kopia publicznych treści strony do szybszego wyświetlenia, bez danych osobowych (localStorage)", "Do odświeżenia treści"],
  ["exm_cisza, exm_shop_view, pod_pos_*, exm_ann_h, exm_install, exm_seen_*", "exmortis", "Niezbędne (Twoje ustawienia)", "Ustawienia Minutnika, widok Skarbca, miejsce w odcinku, ukryte ogłoszenia, podpowiedź instalacji, zapowiedzi (localStorage)", "Do usunięcia przez użytkownika"],
  ["exm_chunk_reload i pamięć podręczna stron", "exmortis", "Niezbędne", "Poprawne wczytanie strony po aktualizacji, szybsze ładowanie (sessionStorage)", "Do zamknięcia karty"],
  ["exm_view, exm_scan_event i podobne", "exmortis", "Niezbędne", "Tylko dla administratora (localStorage)", "Do usunięcia przez użytkownika"],
  ["exm_src", "exmortis", "Analityczne", "Źródło wizyty (np. Instagram) przy zapisie na Wydarzenie (sessionStorage) — tylko po zgodzie", "Do zamknięcia karty"],
  ["_ga, _ga_*", "Google", "Analityczne", "Statystyka odwiedzin (Google Analytics 4) — tylko jeśli jest włączona i tylko po zgodzie", "Do 2 lat"],
  ["_fbp, _fbc", "Meta", "Marketingowe", "Pomiar skuteczności reklam (piksel Meta) — tylko po zgodzie", "Do 90 dni"],
  ["cookies YouTube (np. VISITOR_INFO1_LIVE, YSC)", "Google / YouTube", "Treści zewnętrzne", "Odtwarzacz filmów i muzyki — ładuje się po kliknięciu albo po zgodzie na treści zewnętrzne", "YSC — do zamknięcia przeglądarki; VISITOR_INFO1_LIVE — ok. 6 miesięcy"],
  ["cookies Spotify i Vimeo", "Spotify, Vimeo", "Treści zewnętrzne", "Odtwarzacze — ładują się po kliknięciu albo po zgodzie na treści zewnętrzne", "Według polityk dostawców"],
  ["cookies operatora płatności", "PayU S.A.", "Niezbędne (na stronie PayU)", "Bezpieczeństwo płatności", "Według polityki cookies PayU"],
];

export const COOKIES = {
  title: "Polityka cookies",
  sections: [
    { id: "p1", title: "1. Czym są cookies", body: ["Cookies to małe pliki zapisywane w Twojej przeglądarce. Podobnie działa pamięć przeglądarki (localStorage i sessionStorage), w której zapisujemy np. ustawienia Minutnika ciszy. W tej polityce opisujemy jedne i drugie."] },
    { id: "p2", title: "2. Kto je stosuje", body: ["Administrator Serwisu (dane w Polityce prywatności) oraz — po Twojej zgodzie — dostawcy wskazani w tabeli."] },
    { id: "p3", title: "3. Kiedy pytamy o zgodę", body: [
      "Technologie niezbędne do działania usługi, z której korzystasz (logowanie, koszyk, płatność, zapamiętanie Twoich ustawień i wyboru cookies), stosujemy bez zgody (art. 399 Prawa komunikacji elektronicznej). O pozostałe pytamy osobno w trzech kategoriach i możesz zmienić wybór w każdej chwili w „Ustawieniach cookies” w stopce.",
    ]},
    { id: "p4", title: "4. Kategorie", body: [
      "— Niezbędne: logowanie i sesja, bezpieczeństwo, koszyk i płatność, zapamiętanie Twojego wyboru cookies, ustawienia Minutnika ciszy.",
      "— Analityczne: statystyki odwiedzin i źródło wizyty — po zgodzie.",
      "— Marketingowe: piksel Meta (Facebook/Instagram) — pomiar skuteczności reklam — po zgodzie.",
      "— Treści zewnętrzne: filmy YouTube i Vimeo oraz odtwarzacz Spotify — ładują się od razu tylko po tej zgodzie. Bez niej każdy odtwarzacz włączysz pojedynczo przyciskiem; dopiero wtedy przeglądarka łączy się z dostawcą i przekazuje mu m.in. adres IP. Zdjęcia z naszego Instagrama na stronie głównej pobiera nasz serwer, więc ich wyświetlenie nie łączy Twojej przeglądarki z Instagramem.",
      "Na stronie testu „Która śmierć jest Twoja?” narzędzia analityczne i marketingowe są wyłączone także po wyrażeniu zgody.",
    ]},
    { id: "p5", title: "5. Tabela cookies i pamięci przeglądarki", body: [], table: true },
    { id: "p6", title: "6. Jak zarządzać i jak cofnąć zgodę", body: ["Wybór zmienisz w każdej chwili w „Ustawieniach cookies” w stopce strony — tak samo łatwo jak przy jego wyrażeniu. Po cofnięciu zgody przestajemy ładować te narzędzia i usuwamy pliki _fbp i _fbc. Pliki zapisane przez dostawców na ich domenach oraz pozostałe cookies usuniesz w ustawieniach przeglądarki — zablokowanie niezbędnych może uniemożliwić logowanie i zakupy."] },
    { id: "p7", title: "7. Okres zgody", body: ["Twój wybór pamiętamy 12 miesięcy albo do zmiany tej polityki — wtedy zapytamy ponownie. Ta wersja obowiązuje od 10 listopada 2026 r."] },
  ],
};
