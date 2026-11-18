// Teksty stron logowania i resetu hasła (grupa „Logowanie” w Teksty systemowe i sekcji).
export const LOGIN_BLOCKS = [
  { key: "tytul", label: "Nagłówek", type: "text", default: "Witaj ponownie" },
  { key: "podtytul", label: "Podtytuł", type: "text", default: "Tu czekają Twoje materiały — w jednym miejscu, na chwilę, kiedy zechcesz do nich wrócić." },
  { key: "zakladka.login", label: "Zakładka: logowanie", type: "text", default: "Zaloguj się" },
  { key: "zakladka.rejestracja", label: "Zakładka: rejestracja", type: "text", default: "Załóż konto" },
  { key: "google", label: "Przycisk Google", type: "text", default: "Kontynuuj z Google" },
  { key: "albo", label: "Separator", type: "text", default: "albo" },
  { key: "pole.email", label: "Etykieta: e-mail", type: "text", default: "Adres e-mail" },
  { key: "pole.haslo", label: "Etykieta: hasło", type: "text", default: "Hasło" },
  { key: "nie_pamietam", label: "Link: nie pamiętam hasła", type: "text", default: "Nie pamiętam hasła" },
  { key: "przycisk", label: "Przycisk: zaloguj", type: "text", default: "Zaloguj się" },
  { key: "blad", label: "Błąd logowania", type: "text", default: "Nie udało się zalogować. Sprawdź e-mail i hasło." },
  { key: "reset.tytul", label: "Reset — nagłówek", type: "text", default: "Odzyskaj dostęp" },
  { key: "reset.podtytul", label: "Reset — podtytuł", type: "text", default: "Wyślę Ci link do ustawienia nowego hasła." },
  { key: "reset.przycisk", label: "Reset — przycisk", type: "text", default: "Wyślij link" },
  { key: "reset.wyslano", label: "Reset — komunikat po wysłaniu", type: "text", default: "Jeśli konto z tym adresem istnieje, w ciągu kilku minut otrzymasz wiadomość e-mail z linkiem do ustawienia nowego hasła." },
  { key: "reset.powrot", label: "Reset — powrót do logowania", type: "text", default: "Wróć do logowania" },
  { key: "nowe.tytul", label: "Nowe hasło — nagłówek", type: "text", default: "Ustaw nowe hasło" },
  { key: "nowe.podtytul", label: "Nowe hasło — podtytuł", type: "text", default: "Wpisz nowe hasło dwa razy." },
  { key: "nowe.niezgodne", label: "Błąd: hasła się różnią", type: "text", default: "Hasła nie są takie same." },
  { key: "nowe.blad", label: "Błąd: nie udało się zmienić hasła", type: "text", default: "Nie udało się zmienić hasła. Spróbuj ponownie lub poproś o nowy link." },
  { key: "nowe.zly_link", label: "Błąd: nieprawidłowy link", type: "text", default: "Ten link do zmiany hasła jest nieprawidłowy lub wygasł." },
];
const DEF = Object.fromEntries(LOGIN_BLOCKS.map((b) => [b.key, b.default]));
export { DEF as LOGIN_DEF };