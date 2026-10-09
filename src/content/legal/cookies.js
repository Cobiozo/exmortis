export const BANNER_TEXT =
  "Używamy plików cookies niezbędnych do działania strony. Za Twoją zgodą — także analitycznych i marketingowych (np. piksel Meta), które pomagają nam docierać do osób, którym exmortis może pomóc. Możesz zaakceptować, odrzucić lub wybrać ustawienia — i zmienić zdanie w każdej chwili („Ustawienia cookies” w stopce).";

// Faktyczna pamięć przeglądarki używana przez aplikację (sprawdzone w kodzie).
export const COOKIE_TABLE = [
  ["base44_access_token / token", "Base44 (platforma Serwisu)", "Niezbędne", "Utrzymanie zalogowania (localStorage)", "Do wylogowania"],
  ["exm_cookie_consent", "exmortis", "Niezbędne", "Zapamiętanie wyboru cookies (localStorage)", "12 miesięcy"],
  ["exmortis_cart", "exmortis", "Niezbędne", "Zawartość koszyka (localStorage)", "Do opróżnienia koszyka"],
  ["exm_cisza", "exmortis", "Niezbędne", "Głośność, wybrany czas i tło (localStorage)", "Do usunięcia przez użytkownika"],
  ["exm_view", "exmortis", "Niezbędne", "Tryb podglądu strony — tylko administrator (localStorage)", "Do usunięcia przez użytkownika"],
  ["base44_analytics_session_id", "Base44, Inc. (platforma Serwisu)", "Analityczne", "Statystyka odwiedzin: identyfikator sesji, odwiedzone strony i zdarzenia (localStorage) — działa dopiero po zgodzie", "Do zakończenia sesji lub usunięcia przez użytkownika"],
  ["cookies YouTube (np. VISITOR_INFO1_LIVE, YSC)", "Google / YouTube", "Marketingowe", "Odtwarzacz osadzonych filmów i muzyki", "YSC — do zamknięcia przeglądarki; VISITOR_INFO1_LIVE — ok. 6 miesięcy"],
  ["cookies operatora płatności", "PayU S.A.", "Niezbędne", "Bezpieczeństwo płatności (na stronie operatora)", "Zgodnie z polityką cookies PayU (na stronie operatora)"],
];

export const COOKIES = {
  title: "Polityka cookies",
  sections: [
    { id: "p1", title: "1. Czym są cookies", body: ["Cookies to małe pliki zapisywane w Twojej przeglądarce. Podobnie działa pamięć przeglądarki (localStorage), w której zapisujemy np. ustawienia Minutnika ciszy."] },
    { id: "p2", title: "2. Kto je stosuje", body: ["Administrator Serwisu (dane w Polityce prywatności) oraz — po Twojej zgodzie — nasi partnerzy wskazani w tabeli."] },
    { id: "p3", title: "3. Podstawa", body: ["Cookies niezbędne stosujemy bez zgody, bo bez nich strona nie działa (art. 399 Prawa komunikacji elektronicznej). Pozostałe — wyłącznie po Twojej zgodzie, którą możesz w każdej chwili wycofać."] },
    { id: "p4", title: "4. Kategorie", body: [
      "— Niezbędne: logowanie i sesja, bezpieczeństwo, koszyk/płatność, zapamiętanie Twojego wyboru cookies, ustawienia Minutnika ciszy.",
      "— Analityczne: statystyki odwiedzin (jeśli używamy) — po zgodzie.",
      "— Marketingowe: piksel Meta (Facebook/Instagram) — pomiar skuteczności reklam i docieranie do osób podobnych do naszych odbiorców — po zgodzie.",
    ]},
    { id: "p5", title: "5. Tabela cookies i pamięci przeglądarki", body: [], table: true },
    { id: "p6", title: "6. Jak zarządzać", body: ["„Ustawienia cookies” w stopce strony; możesz też usunąć lub zablokować cookies w ustawieniach przeglądarki — zablokowanie niezbędnych może uniemożliwić logowanie i zakupy."] },
    { id: "p7", title: "7. Okres zgody", body: ["Twój wybór pamiętamy 12 miesięcy, potem zapytamy ponownie."] },
  ],
};