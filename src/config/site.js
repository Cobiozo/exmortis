// JEDYNE miejsce na adres strony i tryb nagłówka dla robotów (Facebook, Google).
// Po podpięciu domeny: SITE_URL = "https://exmortis.pl" i ponowna publikacja.
export const SITE_URL = "https://exmortis-return-path.base44.app";

// Tryb nagłówka: "auto" (spotkanie do MARKA_OD, potem marka), "spotkanie" albo "marka".
// Wspólny nagłówek HTML powstaje przy publikacji, więc w trybie "auto" wystarczy kliknąć „Publikuj” 2.11 rano.
export const META_MODE = "auto";
export const MARKA_OD = "2026-11-02T06:00:00+01:00";

export const OG_SPOTKANIE = {
  title: "1 listopada, 20:00 — Ze śmierci. O powrotach, o których świat nie mówi",
  pageTitle: "1 listopada, 20:00 — Ze śmierci | exmortis",
  d: "Bezpłatne spotkanie online w Wieczór Wszystkich Świętych. Dwie godziny o trzech śmierciach i czterech etapach powrotu. Zapisz się.",
  img: "/exmortis-og-1-listopada-1200x630.png",
  alt: "1 listopada, 20:00 — Ze śmierci. O powrotach, o których świat nie mówi",
};
export const OG_MARKA = {
  title: "exmortis — powrót ze śmierci",
  pageTitle: "exmortis — powrót ze śmierci",
  d: "Mentoring dla osób, które funkcjonują, ale przestały żyć: wypalenie, rozstanie, żałoba, utrata sensu. Listy powrotu, program POWRÓT, spotkania online.",
  img: "/exmortis-og-marka-1200x630.png",
  alt: "exmortis — powrót ze śmierci mentalnej, duchowej i życiowej",
};

export const metaMode = (now = Date.now()) =>
  META_MODE !== "auto" ? META_MODE : now < new Date(MARKA_OD).getTime() ? "spotkanie" : "marka";