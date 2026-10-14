// Model formularza spotkania: domyślne wartości, walidacja kroków, szkic lokalny, zapis.
export const EVENT_TYPES = ["Spotkanie otwarte", "Wieczór powrotu", "Live", "Webinar", "Warsztat", "Warsztat online", "Krąg", "Retreat", "Spotkanie stacjonarne", "Inne"];
export const REG_TYPES = ["Zapis na stronie", "Link zewnętrzny", "Bez zapisu"];
export const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];
export const STEPS = ["Podstawy", "Okładka", "Dostęp i zapisy", "Podgląd i publikacja"];

const pad = (n) => String(n).padStart(2, "0");
// Wszystko w strefie Europe/Warsaw, niezależnie od strefy komputera; w bazie UTC.
const WAW = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
export const wawParts = (d) => { const o = {}; for (const p of WAW.formatToParts(d)) o[p.type] = p.value; return o; };
export function wawToDate(date, time) {
  const [y, m, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const at = (t) => { const p = wawParts(new Date(t)); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t; };
  let t = guess - at(guess); t = guess - at(t);
  return new Date(t);
}
export const wawToday = () => { const p = wawParts(new Date()); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; };
const localParts = (iso) => {
  if (!iso) return { date: "", time: "" };
  const p = wawParts(new Date(iso));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
void pad;
const localInput = (iso) => { const p = localParts(iso); return p.date ? `${p.date}T${p.time}` : ""; };

export const ZOOM_RE = /^https:\/\/([a-z0-9-]+\.)*zoom\.us\//i;

export function initForm(ev) {
  const base = {
    title: "", slug: "", subtitle: "", event_type: "Spotkanie otwarte", format: "Online", duration_minutes: 60,
    location: "", description: "", for_whom: "", price: 0, checkout_url: "", capacity: "", registration_type: "Zapis na stronie",
    external_url: "", join_link: "", join_password: "", recording_url: "", recording_until: "", registration_deadline: "",
    what_registered: "", mailing_group: "", cancel_reason: "", stage: "Wszystkie", status: "Szkic", cover: null,
    open_minutes: 15, zoom_faq: true, short_path: "", tickets: false,
  };
  if (!ev) return { ...base, date: "", time: defaultTime(), paid: false };
  let cover = ev.cover;
  if (typeof cover === "string") { try { cover = JSON.parse(cover); } catch { cover = null; } }
  if (!cover && ev.cover_image) cover = { src: ev.cover_image, alt: "", fx: 0.5, fy: 0.5, dim: 45, source: "wgrana", crops: {}, stale: true };
  const f = { ...base };
  for (const k of Object.keys(base)) if (ev[k] !== undefined && ev[k] !== null) f[k] = ev[k];
  return { ...f, id: ev.id, cover, ...localParts(ev.start_datetime), paid: Number(ev.price) > 0,
    recording_until: localInput(ev.recording_until), registration_deadline: localInput(ev.registration_deadline), deadline_manual: !!ev.registration_deadline };
}

// Domyślna godzina nowego spotkania (ustawienie modułu, zapamiętane w przeglądarce).
export const defaultTime = () => localStorage.getItem("exm_event_time") || "20:00";
export const setDefaultTime = (t) => localStorage.setItem("exm_event_time", t);

const wawInput = (dt) => (dt ? `${dt.slice(0, 10)}T${dt.slice(11, 16)}` : "");
export const wawIso = (dt) => (dt ? wawToDate(dt.slice(0, 10), dt.slice(11, 16)).toISOString() : null);
export const startIso = (f) => (f.date && f.time ? wawToDate(f.date, f.time).toISOString() : null);
// „Zapisy do” = 15 min przed startem, w czasie polskim.
export const autoDeadline = (date, time) => {
  if (!date || !time) return "";
  const p = wawParts(new Date(wawToDate(date, time).getTime() - 15 * 60000));
  return wawInput(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`);
};

// Błędy dla kroku (publish = pełna kontrola przed publikacją).
export function stepErrors(f, step, publish = false) {
  const e = {};
  if (step === 0) {
    if (!f.title.trim()) e.title = "Podaj tytuł spotkania";
    if (!f.date) e.date = "Podaj datę spotkania";
    if (!f.time) e.time = "Podaj godzinę spotkania";
    if (!(Number(f.duration_minutes) >= 5)) e.duration_minutes = "Podaj czas trwania (min. 5 minut)";
    const now = wawToday();
    if (f.date && f.date < now.date) e.date = "Ta data już minęła";
    else if (f.date === now.date && f.time && f.time < now.time) e.time = "Ta godzina już minęła";
  }
  if (step === 1 && f.cover?.src && !String(f.cover.alt || "").trim()) e.cover_alt = "Dodaj opis obrazu dla czytników ekranu";
  if (step === 2) {
    if (f.paid && !(Number(f.price) > 0)) e.price = "Podaj cenę spotkania";
    if (f.paid && !f.tickets && !f.checkout_url) e.checkout_url = "Podaj link płatności albo włącz sprzedaż biletów na stronie";
    if (f.format === "Stacjonarnie" && !f.location.trim()) e.location = "Podaj adres spotkania";
    if (f.registration_type === "Link zewnętrzny" && !f.external_url) e.external_url = "Podaj link do transmisji lub zapisu";
    if (f.format === "Online" && f.join_link && !ZOOM_RE.test(f.join_link.trim())) e.join_link = "To nie wygląda na link do Zoom";
    if (f.format === "Online" && !(Number(f.open_minutes) >= 0)) e.open_minutes = "Podaj liczbę minut";
  }
  return e;
}
export const allErrors = (f, publish) => [0, 1, 2].reduce((a, s) => ({ ...a, ...stepErrors(f, s, publish) }), {});

export function toPayload(f, status) {
  const iso = wawIso;
  const { date, time, paid, cover, deadline_manual, ...rest } = f; // eslint-disable-line no-unused-vars
  return {
    ...rest, id: f.id || null, status, start_datetime: startIso(f),
    duration_minutes: Number(f.duration_minutes) || 60, price: paid ? Number(f.price) || 0 : 0, checkout_url: paid && !f.tickets ? f.checkout_url : "", tickets: paid && f.tickets === true, registration_type: paid && f.tickets === true ? "Zapis na stronie" : f.registration_type,
    location: f.format === "Online" ? f.location || "Online, Zoom" : f.location,
    capacity: f.capacity === "" || f.capacity === null ? null : Number(f.capacity),
    registration_deadline: iso(f.registration_deadline), recording_until: iso(f.recording_until),
    cover: cover?.src ? cover : null, cover_image: cover?.crops?.wide || cover?.src || "",
  };
}

// Szkic lokalny (przetrwa odświeżenie strony).
const key = (id) => `exm_event_draft_${id || "nowe"}`;
export const loadDraft = (id) => { try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; } };
export const saveDraft = (id, form) => { const at = new Date().toISOString(); localStorage.setItem(key(id), JSON.stringify({ at, form })); return at; };
export const clearDraft = (id) => localStorage.removeItem(key(id));