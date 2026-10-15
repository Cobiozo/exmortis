// Teksty systemowe (404 i podziękowania po formularzach). {imie} — imię z formularza.
export const SYSTEM_BLOCKS = [
  { key: "nf.etykieta", label: "404 — etykieta", type: "text", default: "404" },
  { key: "nf.tytul", label: "404 — nagłówek", type: "text", default: "Tej strony tu nie ma." },
  { key: "nf.tekst", label: "404 — tekst", type: "text", default: "Mogła zostać przeniesiona albo nigdy nie istniała. Wróć na drogę." },
  { key: "nf.przycisk", label: "404 — przycisk", type: "text", default: "Strona główna" },
  { key: "dz.spotkanie", label: "Podziękowanie: zapis na spotkanie ({imie} = imię)", type: "text", default: "Dziękuję, {imie}! Twoja rejestracja przebiegła pomyślnie." },
  { key: "dz.listy", label: "Podziękowanie: zapis na Listy powrotu", type: "text", default: "Rejestracja przyjęta. Sprawdź skrzynkę." },
  { key: "dz.pdf", label: "Podziękowanie: zamówienie PDF ({imie} = imię)", type: "text", default: "Gotowe, {imie}. Plik jest już w drodze na Twój e-mail. Jeśli nie widzisz go w ciągu kilku minut, sprawdź folder Spam lub Oferty." },
  { key: "dz.kontakt.tytul", label: "Podziękowanie: kontakt — nagłówek", type: "text", default: "Wiadomość dotarła" },
  { key: "dz.kontakt", label: "Podziękowanie: kontakt — tekst", type: "text", default: "Odpowiadam osobiście, zwykle w ciągu 48 godzin. Do zobaczenia na drodze." },
  { key: "dz.test", label: "Podziękowanie: test (nad wynikiem)", type: "text", default: "Dziękuję. Wynik wysłałem też na Twój e-mail." },
];