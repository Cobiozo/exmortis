// Pola z panelu „Dane do dokumentów”. Puste pole → w dokumencie zostaje tekst w nawiasie.
const TOKENS = {
  "[OPERATOR PŁATNOŚCI]": "operator_nazwa", "[ADRES OPERATORA]": "operator_adres",
  "[BLIK, Przelewy24, karta płatnicza]": "metody", "[24]": "przelozenie_h",
  "[DATA WEJŚCIA W ŻYCIE]": "data_od", "[DOSTAWCA POCZTY]": "poczta",
  "[NAZWA, np. MailerLite]": "newsletter", "[NAZWA]": "biuro",
};

export function fillDocs(text, pola = {}) {
  if (text == null) return text;
  let out = String(text);
  for (const [tok, key] of Object.entries(TOKENS)) if (pola[key]) out = out.split(tok).join(pola[key]);
  return out;
}

// Gdy ustawienia jeszcze nie doszły (tryb awaryjny) — obecne wartości.
export const DEFAULT_POLA = { operator_nazwa: "PayU S.A.", operator_adres: "ul. Grunwaldzka 186, 60-166 Poznań" };

export const plDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : null);