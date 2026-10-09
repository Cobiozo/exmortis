// Teksty stron dołączenia i FAQ spotkań online. {tytul}, {data}, {godzina}, {minuty}, {otwarcie} — wstawiane automatycznie.
export const ONLINE_BLOCKS = [
  { key: "przed", label: "Przed otwarciem pokoju ({minuty}, {otwarcie})", type: "text", default: "Pokój otworzymy {minuty} minut przed startem. Zostaw tę stronę otwartą albo wróć tu o {otwarcie}." },
  { key: "otwarte.przycisk", label: "Pokój otwarty — przycisk", type: "text", default: "Dołącz do spotkania w Zoom" },
  { key: "otwarte.info", label: "Pokój otwarty — wskazówki", type: "text", default: "Na telefonie otworzy się aplikacja Zoom (jeśli jej nie masz — zainstaluj wcześniej). Na komputerze możesz dołączyć przez przeglądarkę. Kamera i mikrofon są wyłączone — widzisz i słyszysz tylko prowadzącego." },
  { key: "brak", label: "Pokój otwarty, brak linku", type: "text", default: "Za chwilę podamy link — odśwież stronę za minutę." },
  { key: "po", label: "Po spotkaniu", type: "text", default: "Spotkanie się zakończyło. Dziękuję za ten wieczór." },
  { key: "odwolane", label: "Spotkanie odwołane", type: "text", default: "To spotkanie zostało odwołane." },
  { key: "faq.imie.q", label: "FAQ 1 — pytanie", type: "text", default: "Czy inni uczestnicy zobaczą moje imię?" },
  { key: "faq.imie.a", label: "FAQ 1 — odpowiedź", type: "text", default: "Nie. To webinar: uczestnicy nie widzą się nawzajem. Widzisz i słyszysz tylko mnie. Pytania możesz zadać anonimowo." },
  { key: "faq.zoom.q", label: "FAQ 2 — pytanie", type: "text", default: "Czy muszę instalować Zoom?" },
  { key: "faq.zoom.a", label: "FAQ 2 — odpowiedź", type: "text", default: "Na komputerze możesz dołączyć przez przeglądarkę. Na telefonie potrzebna jest aplikacja Zoom — najlepiej zainstaluj ją dzień wcześniej." },
];