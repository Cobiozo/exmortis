// Strony wewnętrzne do wyboru w przyciskach (zero literówek w adresach).
export const ROUTES = [
  ["/", "Strona główna"], ["/o-mnie", "O mnie"], ["/powrot", "POWRÓT"], ["/test", "Test"],
  ["/spotkania", "Spotkania"], ["/1-listopada", "1 listopada"], ["/skarbiec", "Skarbiec"], ["/glos", "Głos"],
  ["/cisza", "Cisza"], ["/kontakt", "Kontakt"], ["/konto", "Moje konto"], ["/login", "Logowanie"],
  ["/polityka-prywatnosci", "Polityka prywatności"], ["/regulamin", "Regulamin"],
  ["/polityka-cookies", "Polityka cookies"], ["/odstapienie", "Odstąpienie od umowy"],
];
const DYNAMIC = ["/spotkania/", "/skarbiec/", "/glos/"];

const FIXED = { home: "/", "o-mnie": "/o-mnie", glos: "/glos", kontakt: "/kontakt", powrot: "/powrot", test: "/test", spotkania: "/spotkania", sklep: "/skarbiec" };
export const pagePath = (slug) => FIXED[slug] || `/strona/${slug}`;

// Czy link prowadzi do istniejącego miejsca. extraPaths — adresy stron z edytora.
export function linkError(link, extraPaths = []) {
  const l = String(link || "").trim();
  if (!l) return "brak linku";
  if (l.startsWith("#")) return null;
  if (/^(https:\/\/|mailto:|tel:)/i.test(l)) return null;
  if (/^http:\/\//i.test(l)) return "adres zewnętrzny musi zaczynać się od https://";
  if (!l.startsWith("/")) return "nieprawidłowy adres";
  const path = l.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (ROUTES.some(([p]) => p === path) || extraPaths.includes(path)) return null;
  if (DYNAMIC.some((p) => path.startsWith(p) && path.length > p.length)) return null;
  return `strona ${path} nie istnieje`;
}