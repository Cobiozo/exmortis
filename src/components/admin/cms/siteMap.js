// Wszystkie widoki serwisu (z tras w kodzie). Strony bez zapisu w edytorze są oznaczone etapem migracji.
// status: opublikowana | ukryta | systemowa | szablon; menu: czy jest w górnym menu.
export const SITE_MAP = [
  { slug: "home", tytul: "Strona główna", path: "/", status: "opublikowana", menu: true, zrodlo: "Edytor stron" },
  { slug: "o-mnie", tytul: "O mnie", path: "/o-mnie", status: "opublikowana", menu: true, zrodlo: "Edytor stron" },
  { slug: "kontakt", tytul: "Kontakt", path: "/kontakt", status: "opublikowana", menu: true, zrodlo: "Edytor stron" },
  { slug: "glos", tytul: "Głos", path: "/glos", status: "opublikowana", menu: true, zrodlo: "Edytor stron + moduł Podcast", modul: "/admin/podcast" },
  { slug: "powrot", tytul: "POWRÓT", path: "/powrot", status: "opublikowana", menu: true, zrodlo: "Edytor stron" },
  { slug: "test", tytul: "Test (wstęp, pytania, wyniki)", path: "/test", status: "opublikowana", menu: true, zrodlo: "Edytor stron + moduł Test", modul: "/admin/testy" },
  { slug: "spotkania", tytul: "Spotkania", path: "/spotkania", status: "opublikowana", menu: true, zrodlo: "Edytor stron + moduł Spotkania", modul: "/admin/spotkania" },
  { slug: "sklep", tytul: "Skarbiec", path: "/skarbiec", status: "opublikowana", menu: true, zrodlo: "Edytor stron + moduł Skarbiec", modul: "/admin/skarbiec" },
  { slug: "cisza", tytul: "Cisza (minutnik)", path: "/cisza", status: "opublikowana", menu: true, zrodlo: "Teksty i wygląd w module Cisza", procent: 100, etap: 4, modul: "/admin/cisza" },
  { slug: "1-listopada", tytul: "1 listopada", path: "/1-listopada", status: "ukryta", menu: false, zrodlo: "Edytor (bloki + formularz zapisu na spotkanie)", procent: 100, etap: 4 },
  { slug: "_spotkanie", tytul: "Szablon: pojedyncze spotkanie", path: "/spotkania/…", status: "szablon", menu: false, zrodlo: "Edytor stron + moduł Spotkania", modul: "/admin/spotkania" },
  { slug: "_produkt", tytul: "Szablon: produkt", path: "/skarbiec/…", status: "szablon", menu: false, zrodlo: "Edytor stron + moduł Skarbiec", modul: "/admin/skarbiec" },
  { slug: "_odcinek", tytul: "Szablon: odcinek podcastu", path: "/glos/…", status: "szablon", menu: false, zrodlo: "Edytor stron + moduł Podcast", modul: "/admin/podcast" },
  { slug: "_kasa", tytul: "Kasa", path: "/kasa", status: "systemowa", menu: false, zrodlo: "Kod", procent: 0, etap: 4 },
  { slug: "_login", tytul: "Logowanie i rejestracja", path: "/login", status: "systemowa", menu: false, zrodlo: "Kod", procent: 0, etap: 4 },
  { slug: "_konto", tytul: "Moje konto", path: "/konto", status: "systemowa", menu: false, zrodlo: "Kod + moduł Klienci", procent: 0, etap: 4, modul: "/admin/klienci" },
  { slug: "_404", tytul: "Strona nie istnieje (404)", path: "/nie-ma-takiej-strony", status: "systemowa", menu: false, zrodlo: "Teksty systemowe", procent: 100, modul: "/admin/tresci?tab=teksty&strona=system" },
  { slug: "_dzieki", tytul: "Podziękowania po zapisach (spotkanie, Listy, PDF, kontakt, test)", path: "/kontakt", status: "systemowa", menu: false, zrodlo: "Teksty systemowe", procent: 100, modul: "/admin/tresci?tab=teksty&strona=system" },
  { slug: "_prawne", tytul: "Dokumenty prawne (4)", path: "/regulamin", status: "systemowa", menu: false, zrodlo: "Moduł Dokumenty prawne", poza: true },
  { slug: "_menu", tytul: "Menu i stopka", path: "/", status: "systemowa", menu: false, zrodlo: "Edytor menu i stopki", procent: 100, etap: 8, modul: "/admin/menu" },
];

export const STATUS_LABEL = { opublikowana: "Opublikowana", ukryta: "Ukryta", szkic: "Szkic", zaplanowana: "Zaplanowana", systemowa: "Systemowa", szablon: "Szablon" };
export const FILTERS = [["wszystkie", "Wszystkie"], ["opublikowana", "Opublikowane"], ["ukryta", "Ukryte"], ["szkic", "Szkice"], ["zaplanowana", "Zaplanowane"], ["systemowa", "Systemowe"], ["szablon", "Szablony"]];