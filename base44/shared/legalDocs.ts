import { getSetting } from "./settings.ts";

// Dane do dokumentów prawnych (app_settings: "dokumenty") + archiwum pełnych treści (LegalDocVersion).
// Nowa wersja (+0.1) powstaje, gdy zmieni się gotowy tekst dokumentu — pole albo tekst w kodzie.
export const DOC_KEYS = ["operator_nazwa", "operator_adres", "metody", "przelozenie_h", "data_od", "poczta", "newsletter", "biuro"];
const DOCS = ["regulamin", "prywatnosc", "cookies", "umowa_powrot"];
const BASE = { regulamin: "1.0", prywatnosc: "1.1", cookies: "1.0", umowa_powrot: "1.0" };

const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
const bump = (v) => (Math.round(parseFloat(v || "1.0") * 10 + 1) / 10).toFixed(1);
const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
  .map((b) => b.toString(16).padStart(2, "0")).join("");

export function cleanPola(data) {
  const out = {};
  for (const k of DOC_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  if (out.przelozenie_h && !/^\d{1,3}$/.test(out.przelozenie_h)) throw new Error("Termin przełożenia podaj w pełnych godzinach (np. 24).");
  return out;
}

// Mała część do funkcji startowej: pola + numer i data bieżącej wersji (bez treści archiwum).
export function publicDocs(s) {
  const docs = {};
  for (const d of DOCS) docs[d] = { version: s?.docs?.[d]?.version || BASE[d], date: s?.docs?.[d]?.date || null };
  return { pola: cleanPola(s?.pola || {}), docs };
}

function cleanSnap(x) {
  const str = (v, n) => String(v ?? "").slice(0, n);
  return {
    title: str(x?.title, 300),
    sections: (Array.isArray(x?.sections) ? x.sections : []).slice(0, 80).map((s) => ({
      id: str(s.id, 80), title: str(s.title, 300),
      body: (Array.isArray(s.body) ? s.body : []).slice(0, 200).map((p) => str(p, 5000)),
      ...(Array.isArray(s.table) ? { table: s.table.slice(0, 50).map((r) => (Array.isArray(r) ? r : []).slice(0, 8).map((c) => str(c, 500))) } : {}),
    })),
  };
}

// snapshots: { regulamin: {title, sections}, ... } — gotowy tekst złożony w panelu.
export async function syncDocs(base44, data, snapshots, kto) {
  const prev = publicDocs(await getSetting(base44, "dokumenty"));
  const E = base44.asServiceRole.entities.LegalDocVersion;
  const docs = { ...prev.docs };
  const created = [];
  for (const d of DOCS) {
    if (!snapshots?.[d]) continue;
    const snap = cleanSnap(snapshots[d]);
    const hash = await sha(JSON.stringify(snap));
    const last = (await E.filter({ doc: d }, "-created_date", 1))[0];
    if (last?.hash === hash) { docs[d] = { version: last.version, date: last.date }; continue; }
    const version = last ? bump(last.version) : prev.docs[d].version;
    const date = warsawToday();
    await E.create({ doc: d, version, date, ...snap, hash, kto });
    docs[d] = { version, date };
    created.push(`${d} ${version}`);
  }
  return { value: { pola: cleanPola(data), docs }, created };
}

export async function regulaminVersion(base44) {
  return publicDocs(await getSetting(base44, "dokumenty").catch(() => null)).docs.regulamin.version;
}

// Regulamin w wersji z dnia zamówienia jako załącznik e-maila (trwały nośnik, art. 21 upk).
// Treść z archiwum wersji (LegalDocVersion). Brak archiwum = brak załącznika (zostaje link w e-mailu).
export async function regulaminAttachment(base44) {
  return docAttachment(base44, "regulamin", "Regulamin-exmortis");
}

// Najnowsza zapisana wersja dokumentu (archiwum) jako załącznik HTML — trwały nośnik dla klienta.
// null, gdy dokumentu nie ma jeszcze w archiwum (Ustawienia → Dokumenty prawne → Zapisz).
export async function docAttachment(base44, doc, fileBase) {
  try {
    const last = (await base44.asServiceRole.entities.LegalDocVersion.filter({ doc }, "-created_date", 1))[0];
    if (!last?.sections?.length) return null;
    const e = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const body = last.sections.map((s) => `<h2>${e(s.title)}</h2>${(s.body || []).map((p) => `<p>${e(p)}</p>`).join("")}`).join("");
    const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${e(last.title)}</title></head><body style="font-family:Georgia,serif;max-width:760px;margin:24px auto;line-height:1.6;"><h1>${e(last.title)}</h1><p>Wersja ${e(last.version)} z dnia ${e(last.date)}</p>${body}</body></html>`;
    return { filename: `${fileBase}-${String(last.version).replace(/[^0-9.]/g, "")}.html`, content: html, contentType: "text/html; charset=utf-8" };
  } catch {
    return null;
  }
}

// Numer i data najnowszej zapisanej wersji dokumentu z archiwum (np. umowy POWRÓT) — null, gdy brak.
export async function docLatest(base44, doc) {
  try {
    const last = (await base44.asServiceRole.entities.LegalDocVersion.filter({ doc }, "-created_date", 1))[0];
    return last?.sections?.length ? { version: String(last.version), date: String(last.date || "") } : null;
  } catch {
    return null;
  }
}
