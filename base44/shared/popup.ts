// Popup na stronie (Panel → Ogłoszenia → Popup): krótka informacja dla odwiedzających,
// np. o nadchodzącym spotkaniu albo kodzie rabatowym. Ustawienie publiczne (app_settings: "popup").
// Każdy zapis podnosi wersję — odwiedzający, którzy zamknęli poprzedni popup, zobaczą nowy.
export const POPUP_DEFAULT = {
  aktywny: false, tytul: "", tresc: "", przycisk_napis: "", przycisk_link: "", kod: "",
  od: null, do: null, komu: "wszyscy", opoznienie: 8, wersja: 0,
};

const str = (v: unknown, n: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, n);
const iso = (v: unknown) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
// Link: adres na stronie (/...) albo https:// — nic innego (bez javascript: i podobnych).
const link = (v: unknown) => {
  const s = str(v, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
};

export function cleanPopup(data: any, prevVersion = 0) {
  const d = data || {};
  const komu = ["wszyscy", "goscie", "zalogowani"].includes(d.komu) ? d.komu : "wszyscy";
  const op = Math.round(Number(d.opoznienie));
  return {
    aktywny: d.aktywny === true,
    tytul: str(d.tytul, 120),
    tresc: str(d.tresc, 800),
    przycisk_napis: str(d.przycisk_napis, 40),
    przycisk_link: link(d.przycisk_link),
    kod: str(d.kod, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
    od: iso(d.od),
    do: iso(d.do),
    komu,
    opoznienie: Number.isFinite(op) ? Math.max(0, Math.min(60, op)) : 8,
    wersja: (Number(prevVersion) || 0) + 1,
  };
}

// Publicznie tylko popup, który jest włączony i ma treść (daty sprawdza przeglądarka z czasem serwera).
export function publicPopup(p: any) {
  const v = { ...POPUP_DEFAULT, ...(p || {}) };
  if (!v.aktywny || !(v.tytul || v.tresc)) return null;
  return v;
}
