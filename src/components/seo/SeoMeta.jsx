import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PRE_UNTIL = new Date("2026-11-01T21:30:00+01:00").getTime();
const PRE = {
  title: "1 listopada, 20:00 — Ze śmierci. O powrotach, o których świat nie mówi",
  desc: "Bezpłatne spotkanie online w Wieczór Wszystkich Świętych. 90 minut o trzech śmierciach i czterech etapach powrotu. Zapisz się.",
};
const DEFAULT_DESC = "Wypalenie, rozstanie, żałoba, utrata sensu? Wróciłem i uczę wracać. Zapisz się na Listy powrotu albo poznaj program POWRÓT.";
const TITLES = {
  "/": "exmortis — ze śmierci", "/1-listopada": "Ze śmierci — spotkanie 1 listopada, 20:00 | exmortis",
  "/o-mnie": "O mnie — exmortis", "/powrot": "POWRÓT — exmortis", "/skarbiec": "Skarbiec — exmortis", "/spotkania": "Spotkania — exmortis",
  "/cisza": "Cisza — exmortis", "/glos": "Głos — exmortis", "/kontakt": "Kontakt — exmortis", "/test": "Test — exmortis",
  "/regulamin": "Regulamin — exmortis", "/polityka-prywatnosci": "Polityka prywatności — exmortis",
  "/polityka-cookies": "Polityka cookies — exmortis", "/odstapienie": "Odstąpienie od umowy — exmortis", "/obok": "Obok — exmortis",
};

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
};

// Tytuł i opisy strony: do 1.11, 21:30 wspólne teksty spotkania, potem osobne dla każdej strony.
export default function SeoMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pre = Date.now() < PRE_UNTIL;
    const title = TITLES[pathname] || "exmortis";
    document.title = title;
    const ogTitle = pre ? PRE.title : title;
    const desc = pre ? PRE.desc : DEFAULT_DESC;
    setMeta("property", "og:title", ogTitle);
    setMeta("name", "twitter:title", ogTitle);
    setMeta("name", "description", desc);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", window.location.origin + pathname);
    setMeta("property", "og:locale", "pl_PL");
  }, [pathname]);
  return null;
}