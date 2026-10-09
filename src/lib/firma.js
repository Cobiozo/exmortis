// Podstawianie danych firmy w tekstach. Punkt numerowany nigdy nie znika (puste pole → „…”);
// linia nienumerowana (np. telefon) z pustym polem jest ukrywana (zwraca null).
const TOKENS = {
  "[IMIĘ I NAZWISKO]": "osoba", "[NAZWA FIRMY]": "nazwa", "[ADRES DZIAŁALNOŚCI]": "adres",
  "[ADRES DO KORESPONDENCJI]": "korespondencja", "[NIP]": "nip", "[REGON]": "regon",
  "[E-MAIL KONTAKTOWY]": "email", "[TELEFON]": "telefon",
};

export function fillFirma(text, firma = {}) {
  let out = String(text);
  const numbered = /^\d+\./.test(out);
  for (const [tok, key] of Object.entries(TOKENS)) {
    if (!out.includes(tok)) continue;
    if (!firma[key] && !numbered) return null;
    out = out.split(tok).join(firma[key] || "…");
  }
  return out;
}

export const REQUIRED = [["nazwa", "nazwa firmy"], ["osoba", "imię i nazwisko"], ["adres", "adres działalności"], ["korespondencja", "adres do korespondencji"], ["nip", "NIP"], ["regon", "REGON"], ["email", "e-mail kontaktowy"]];
export const missingFirma = (f = {}) => REQUIRED.filter(([k]) => !f[k]).map(([, l]) => l);

export const BASIS = {
  interes: "na podstawie mojego prawnie uzasadnionego interesu (art. 6 ust. 1 lit. f RODO)",
  obowiazek: "w celu wypełnienia obowiązku prawnego (art. 6 ust. 1 lit. c RODO)",
  umowa: "w celu wykonania umowy o świadczenie usługi (art. 6 ust. 1 lit. b RODO)",
};

// Klauzula pod formularzami — zawsze zaczyna się od administratora.
export const clause = (purpose, basis, f = {}) =>
  `Administratorem danych jest ${f.nazwa || "…"}, ${f.adres || "…"}. Przetwarzam je, aby ${purpose}, ${BASIS[basis]}. Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, sprzeciwu i skargi do Prezesa UODO.`;