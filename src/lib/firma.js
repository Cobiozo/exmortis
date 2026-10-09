// Podstawianie danych firmy w tekstach. Linia z pustym polem jest ukrywana (zwraca null).
const TOKENS = {
  "[IMIĘ I NAZWISKO]": "osoba", "[NAZWA FIRMY]": "nazwa", "[ADRES DZIAŁALNOŚCI]": "adres",
  "[ADRES DO KORESPONDENCJI]": "korespondencja", "[NIP]": "nip", "[REGON]": "regon",
  "[E-MAIL KONTAKTOWY]": "email", "[TELEFON]": "telefon",
};

export function fillFirma(text, firma = {}) {
  let out = String(text);
  for (const [tok, key] of Object.entries(TOKENS)) {
    if (!out.includes(tok)) continue;
    if (!firma[key]) return null;
    out = out.split(tok).join(firma[key]);
  }
  return out;
}

export const REQUIRED = [["nazwa", "nazwa firmy"], ["osoba", "imię i nazwisko"], ["adres", "adres działalności"], ["korespondencja", "adres do korespondencji"], ["nip", "NIP"], ["regon", "REGON"], ["email", "e-mail kontaktowy"]];
export const missingFirma = (f = {}) => REQUIRED.filter(([k]) => !f[k]).map(([, l]) => l);

// Klauzula pod formularzami: administratorem jest pełna nazwa firmy.
export const clause = (purpose, f = {}) =>
  `${f.nazwa ? `Administratorem Twoich danych jest ${f.nazwa}. ` : ""}Przetwarzamy je, aby ${purpose}. Masz prawo dostępu do danych, ich poprawienia, usunięcia i wycofania zgody.`;