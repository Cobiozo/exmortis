// Dane do dokumentów prawnych (app_settings: "dokumenty").
// Zmiana pola używanego przez dokument = nowa wersja tego dokumentu (+0.1), poprzednia trafia do archiwum.
export const DOC_KEYS = ["operator_nazwa", "operator_adres", "metody", "przelozenie_h", "data_od", "poczta", "newsletter", "biuro"];
const USES = {
  regulamin: ["operator_nazwa", "operator_adres", "metody", "przelozenie_h", "data_od"],
  prywatnosc: ["operator_nazwa", "operator_adres", "poczta", "newsletter", "biuro", "data_od"],
  cookies: ["operator_nazwa", "data_od"],
};
const BASE = { regulamin: "1.0", prywatnosc: "1.1", cookies: "1.0" };

const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
const bump = (v) => (Math.round(parseFloat(v || "1.0") * 10 + 1) / 10).toFixed(1);

export function cleanPola(data) {
  const out = {};
  for (const k of DOC_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  if (out.przelozenie_h && !/^\d{1,3}$/.test(out.przelozenie_h)) throw new Error("Termin przełożenia podaj w pełnych godzinach (np. 24).");
  return out;
}

export function publicDocs(s) {
  const pola = cleanPola(s?.pola || {});
  const docs = {};
  for (const d of Object.keys(USES)) {
    const x = s?.docs?.[d] || {};
    docs[d] = { version: x.version || BASE[d], date: x.date || null, archiwum: Array.isArray(x.archiwum) ? x.archiwum : [] };
  }
  return { pola, docs };
}

// prev = zapisane ustawienie (albo null przy pierwszym zapisie — wtedy bez nowych wersji).
export function nextDocs(prev, data) {
  const pola = cleanPola(data);
  const cur = publicDocs(prev);
  if (!prev) return { pola, docs: cur.docs };
  const today = warsawToday();
  const docs = {};
  for (const [d, keys] of Object.entries(USES)) {
    const old = cur.docs[d];
    const changed = keys.some((k) => cur.pola[k] !== pola[k]);
    docs[d] = changed
      ? { version: bump(old.version), date: today, archiwum: [{ version: old.version, date: old.date, pola: cur.pola }, ...old.archiwum].slice(0, 30) }
      : old;
  }
  return { pola, docs };
}