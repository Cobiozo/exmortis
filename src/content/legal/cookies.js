export const BANNER_TEXT =
  "Używamy plików cookies niezbędnych do działania strony. Za Twoją zgodą — także analitycznych i marketingowych (np. piksel Meta) oraz odtwarzaczy YouTube i Spotify. Możesz zaakceptować, odrzucić lub wybrać ustawienia — i zmienić zdanie w każdej chwili („Ustawienia cookies” w stopce).";

export const BANNER_TEXT_SHORT = "Używamy cookies niezbędnych do działania strony. Analityczne i marketingowe — tylko za Twoją zgodą.";

// Faktyczna pamięć przeglądarki używana przez aplikację (sprawdzone w kodzie).
export const COOKIE_TABLE = [
  ["exm_supa_session, exm_auth_user", "exmortis", "Niezbędne", "Utrzymanie zalogowania (localStorage)", "Do wylogowania"],
  ["exm_auth_return, exm_login_via, exm_pending_reg", "exmortis", "Niezbędne", "Powrót na właściwą stronę po logowaniu lub rejestracji (sessionStorage)", "Do zamknięcia karty"],
  ["exm_cookie_consent", "exmortis", "Niezbędne", "Zapamiętanie wyboru cookies (localStorage)", "12 miesięcy"],
  ["exmortis_cart, exm_payu_order, exm_payu_value", "exmortis", "Niezbędne", "Koszyk i powrót z płatności (localStorage)", "Do opróżnienia koszyka lub zakończenia płatności"],
  ["exm_outbox", "exmortis", "Niezbędne", "Kopia formularza kontaktu lub zapisu, gdy serwer chwilowo nie odpowiada — wysyłana ponownie i usuwana (localStorage)", "Do wysłania"],
  ["exm_cisza, exm_shop_view, pod_pos_*, exm_ann_h, exm_install, exm_seen_*", "exmortis", "Niezbędne (Twoje ustawienia)", "Ustawienia Minutnika, widok Skarbca, miejsce w odcinku, ukryte ogłoszenia, podpowiedź instalacji, zapowiedzi (localStorage)", "Do usunięcia przez użytkownika"],
  ["exm_chunk_reload i pamięć podręczna stron", "exmortis", "Niezbędne", "Poprawne wczytanie strony po aktualizacji, szybsze ładowanie (sessionStorage)", "Do zamknięcia karty"],
  ["exm_view, exm_scan_event i podobne", "exmortis", "Niezbędne", "Tylko dla administratora (localStorage)", "Do usunięcia przez użytkownika"],
  ["base44_analytics_session_id", "Base44, Inc. (platforma Serwisu)", "Niezbędne (identyfikator platformy)", "Losowy identyfikator sesji tworzony przez platformę przy pierwszej wizycie (localStorage). Bez zgody na cookies analityczne nie wysyłamy z nim żadnych danych; po „Odrzucam” jest usuwany", "Do zakończenia sesji, odrzucenia zgody lub usunięcia przez użytkownika"],
  ["exm_src", "exmortis", "Analityczne", "Źródło wizyty (np. Instagram) przy zapisie na Spotkanie (sessionStorage) — tylko po zgodzie", "Do zamknięcia karty"],
  ["_ga, _ga_[ID]", "Google", "Analityczne", "Statystyka odwiedzin (Google Analytics 4) — tylko po zgodzie", "Do 2 lat"],
  ["_fbp, _fbc", "Meta", "Marketingowe", "Pomiar skuteczności reklam (piksel Meta) — tylko po zgodzie", "Do 90 dni"],
  ["cookies YouTube (np. VISITOR_INFO1_LIVE, YSC)", "Google / YouTube", "Treści zewnętrzne", "Odtwarzacz filmów i muzyki — ładuje się po kliknięciu albo po zgodzie marketingowej", "YSC — do zamknięcia przeglądarki; VISITOR_INFO1_LIVE — ok. 6 miesięcy"],
  ["cookies Spotify", "Spotify", "Treści zewnętrzne", "Odtwarzacz odcinków — ładuje się po kliknięciu albo po zgodzie marketingowej", "Według polityki Spotify"],
  ["obrazy Instagrama", "Meta", "Treści zewnętrzne", "Zdjęcia z profilu na stronie głównej — po kliknięciu albo po zgodzie marketingowej", "Według polityki Meta"],
  ["cookies operatora płatności", "[OPERATOR PŁATNOŚCI]", "Niezbędne", "Bezpieczeństwo płatności (na stronie operatora)", "Zgodnie z polityką cookies operatora (na jego stronie)"],
];

export const COOKIES = {
  title: "Polityka cookies",
  sections: [
    { id: "p1", title: "1. Czym są cookies", body: ["Cookies to małe pliki zapisywane w Twojej przeglądarce. Podobnie działa pamięć przeglądarki (localStorage i sessionStorage), w której zapisujemy np. ustawienia Minutnika ciszy. W tej polityce opisujemy jedne i drugie."] },
    { id: "p2", title: "2. Kto je stosuje", body: ["Administrator Serwisu (dane w Polityce prywatności) oraz — po Twojej zgodzie — nasi partnerzy wskazani w tabeli."] },
    { id: "p3", title: "3. Podstawa", body: ["Technologie niezbędne do działania usługi, z której korzystasz (logowanie, koszyk, zapamiętanie Twoich ustawień i wyboru cookies), stosujemy bez zgody (art. 399 Prawa komunikacji elektronicznej). Pozostałe — wyłącznie po Twojej zgodzie, którą możesz w każdej chwili zmienić w „Ustawieniach cookies” w stopce."] },
    { id: "p4", title: "4. Kategorie", body: [
      "— Niezbędne: logowanie i sesja, bezpieczeństwo, koszyk/płatność, zapamiętanie Twojego wyboru cookies, ustawienia Minutnika ciszy.",
      "— Analityczne: statystyki odwiedzin (Google Analytics 4) i źródło wizyty — po zgodzie.",
      "— Marketingowe: piksel Meta (Facebook/Instagram) — pomiar skuteczności reklam i docieranie do osób podobnych do naszych odbiorców — po zgodzie.",
      "— Treści zewnętrzne: filmy YouTube, odtwarzacz Spotify i zdjęcia z Instagrama — ładują się dopiero po Twoim kliknięciu albo po zgodzie marketingowej. Wcześniej dostawca nie otrzymuje żadnych danych.",
    ]},
    { id: "p5", title: "5. Tabela cookies i pamięci przeglądarki", body: [], table: true },
    { id: "p6", title: "6. Jak zarządzać", body: ["„Ustawienia cookies” w stopce strony; możesz też usunąć lub zablokować cookies w ustawieniach przeglądarki — zablokowanie niezbędnych może uniemożliwić logowanie i zakupy."] },
    { id: "p7", title: "7. Okres zgody", body: ["Twój wybór pamiętamy 12 miesięcy albo do zmiany tej polityki — wtedy zapytamy ponownie."] },
  ],
};